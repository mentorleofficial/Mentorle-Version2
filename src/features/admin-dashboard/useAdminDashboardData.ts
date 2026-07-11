import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminSessionRow = {
  id: string;
  scheduled_at: string;
  created_at: string;
  duration_minutes: number;
  status: "booked" | "completed" | "cancelled";
  mentor_id: string;
  mentee_id: string;
  mentor?: { id: string; full_name: string; email: string } | null;
  mentee?: { id: string; full_name: string; email: string } | null;
};

export type AdminUserRow = {
  id: string;
  created_at: string;
  role: "admin" | "mentor" | "mentee";
};

export type AdminFeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  session_id: string;
  audience: string;
};

export type AdminMentorLite = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

export type AdminProgramLite = {
  id: string;
  name: string;
  slug: string;
  mentors: number;
  mentees: number;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  user_id: string | null;
  actor_name?: string | null;
};

export type AdminDashData = {
  counts: {
    users: number;
    mentors: number;
    mentees: number;
    sessions: number;
    pendingApps: number;
    disabledUsers: number;
  };
  totals: {
    hours: number;
    avgRating: number | null;
  };
  sessions30: AdminSessionRow[];
  users30: AdminUserRow[];
  feedback60: AdminFeedbackRow[];
  recentFeedback: AdminFeedbackRow[];
  programs: AdminProgramLite[];
  mentorsById: Record<string, AdminMentorLite>;
  branding: { app_name: string; logo_url: string | null } | null;
  jwtEnabled: boolean;
  audit: AdminAuditRow[];
};

const DAY = 86400000;

export const useAdminDashboardData = () =>
  useQuery<AdminDashData>({
    queryKey: ["admin-dashboard"],
    staleTime: 30_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const since30 = new Date(Date.now() - 30 * DAY).toISOString();
      const since60 = new Date(Date.now() - 60 * DAY).toISOString();

      const [
        usersCount,
        mentorsCount,
        menteesCount,
        sessionsCount,
        pendingAppsCount,
        disabledCount,
        completedHoursRes,
        avgRatingRes,
        sess30Res,
        users30Res,
        fb60Res,
        recentFbRes,
        programsRes,
        brandingRes,
        jwtRes,
        auditRes,
      ] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "mentor"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "mentee"),
        supabase.from("sessions").select("id", { count: "exact", head: true }),
        supabase.from("mentor_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("is_disabled", true),
        supabase.from("sessions").select("duration_minutes").eq("status", "completed"),
        supabase.from("feedback").select("rating").eq("audience", "mentor"),
        supabase
          .from("sessions")
          .select(
            `id, scheduled_at, created_at, duration_minutes, status, mentor_id, mentee_id,
             mentor:users!sessions_mentor_id_fkey(id, full_name, email),
             mentee:users!sessions_mentee_id_fkey(id, full_name, email)`
          )
          .gte("created_at", since30),
        supabase
          .from("users")
          .select("id, created_at, role")
          .gte("created_at", since30),
        supabase
          .from("feedback")
          .select("id, rating, comment, created_at, session_id, audience")
          .eq("audience", "mentor")
          .gte("created_at", since60),
        supabase
          .from("feedback")
          .select("id, rating, comment, created_at, session_id, audience")
          .eq("audience", "mentor")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("programs")
          .select("id, name, slug, program_mentors(count), program_mentees(count)"),
        supabase.from("branding").select("app_name, logo_url").limit(1).maybeSingle(),
        supabase.from("jwt_config").select("enabled").limit(1).maybeSingle(),
        supabase
          .from("audit_logs")
          .select("id, action, entity_type, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const hours =
        ((completedHoursRes.data ?? []) as { duration_minutes: number }[]).reduce(
          (s, r) => s + (r.duration_minutes || 0),
          0
        ) / 60;
      const ratings = ((avgRatingRes.data ?? []) as { rating: number }[]).map((r) => r.rating);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      let sessions30 = (sess30Res.data as AdminSessionRow[] | null) ?? [];
      const mentorIds = Array.from(new Set(sessions30.map((s) => s.mentor_id)));
      let mentorsById: Record<string, AdminMentorLite> = {};
      if (mentorIds.length > 0) {
        const mres = await supabase
          .from("users")
          .select("id, full_name, avatar_url")
          .in("id", mentorIds);
        ((mres.data as AdminMentorLite[] | null) ?? []).forEach((m) => {
          mentorsById[m.id] = m;
        });
      }

      // Ensure mentee names are available as well — fetch if nested select didn't return them
      const menteeIds = Array.from(new Set(sessions30.map((s) => s.mentee_id)));
      let menteesById: Record<string, { id: string; full_name: string; email: string }> = {};
      if (menteeIds.length > 0) {
        const eres = await supabase.from("users").select("id, full_name, email").in("id", menteeIds);
        ((eres.data as { id: string; full_name: string; email: string }[] | null) ?? []).forEach((u) => {
          menteesById[u.id] = u;
        });
      }

      // Attach mentor/mentee objects onto sessions when nested fields are missing
      sessions30 = sessions30.map((s) => ({
        ...s,
        mentor: s.mentor ?? (mentorsById[s.mentor_id] ? { id: mentorsById[s.mentor_id].id, full_name: mentorsById[s.mentor_id].full_name, email: "" } : null),
        mentee: s.mentee ?? menteesById[s.mentee_id] ?? null,
      }));

      const auditRows = (auditRes.data as AdminAuditRow[] | null) ?? [];
      const actorIds = Array.from(
        new Set(auditRows.map((r) => r.user_id).filter((v): v is string => !!v))
      );
      const actorMap: Record<string, string> = {};
      if (actorIds.length > 0) {
        const ares = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", actorIds);
        ((ares.data as { id: string; full_name: string }[] | null) ?? []).forEach((u) => {
          actorMap[u.id] = u.full_name;
        });
      }
      const audit = auditRows.map((r) => ({
        ...r,
        actor_name: r.user_id ? actorMap[r.user_id] ?? null : null,
      }));

      const programs: AdminProgramLite[] = (
        (programsRes.data as
          | { id: string; name: string; slug: string; program_mentors: { count: number }[]; program_mentees: { count: number }[] }[]
          | null) ?? []
      ).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        mentors: p.program_mentors?.[0]?.count ?? 0,
        mentees: p.program_mentees?.[0]?.count ?? 0,
      }));

      return {
        counts: {
          users: usersCount.count ?? 0,
          mentors: mentorsCount.count ?? 0,
          mentees: menteesCount.count ?? 0,
          sessions: sessionsCount.count ?? 0,
          pendingApps: pendingAppsCount.count ?? 0,
          disabledUsers: disabledCount.count ?? 0,
        },
        totals: { hours, avgRating },
        sessions30,
        users30: (users30Res.data as AdminUserRow[] | null) ?? [],
        feedback60: (fb60Res.data as AdminFeedbackRow[] | null) ?? [],
        recentFeedback: (recentFbRes.data as AdminFeedbackRow[] | null) ?? [],
        programs,
        mentorsById,
        branding: brandingRes.data as { app_name: string; logo_url: string | null } | null,
        jwtEnabled: !!(jwtRes.data as { enabled: boolean } | null)?.enabled,
        audit,
      };
    },
  });
