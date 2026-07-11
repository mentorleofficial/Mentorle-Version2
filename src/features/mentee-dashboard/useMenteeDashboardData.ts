import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMenteeSessions,
  menteeSessionsKey,
  type MenteeSessionRow,
} from "@/features/mentee-sessions/useMenteeSessions";

// Re-export shapes that dashboard child components consume.
export type DashSession = MenteeSessionRow;

export type DashFeedback = {
  id: string;
  session_id: string;
  rating: number;
  created_at: string;
};

export type RecommendedMentor = {
  user_id: string;
  slug: string | null;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
  current_role: string | null;
};

export type DashData = {
  sessions: DashSession[];
  feedback: DashFeedback[];
  preferredAreas: string[];
  recommended: RecommendedMentor[];
};

export const useMenteeDashboardData = (userId?: string) => {
  const qc = useQueryClient();

  return useQuery<DashData>({
    queryKey: ["mentee-dashboard", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      // Reuse the sessions cache shared with the My Sessions page.
      const cached = qc.getQueryData<MenteeSessionRow[]>(menteeSessionsKey(userId));
      const sessionsPromise = cached
        ? Promise.resolve(cached)
        : qc.fetchQuery({
            queryKey: menteeSessionsKey(userId),
            staleTime: 60_000,
            queryFn: () => fetchMenteeSessions(userId!),
          });

      const [sessions, fbRes, profRes, mentorsRes] = await Promise.all([
        sessionsPromise,
        supabase
          .from("feedback")
          .select("id, session_id, rating, created_at")
          .eq("submitted_by", userId!)
          .eq("audience", "mentor"),
        supabase
          .from("mentee_profiles")
          .select("preferred_mentor_areas")
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase.rpc("list_public_mentors"),
      ]);

      const preferredAreas: string[] =
        (profRes.data?.preferred_mentor_areas as string[] | null) ?? [];
      const allMentors = (mentorsRes.data as RecommendedMentor[] | null) ?? [];
      const lcAreas = preferredAreas.map((a) => a.toLowerCase());
      const scored = allMentors
        .map((m) => {
          const exp = (m.expertise ?? []).map((e) => e.toLowerCase());
          const overlap = exp.filter((e) => lcAreas.includes(e)).length;
          return { m, overlap };
        })
        .sort(
          (a, b) =>
            b.overlap - a.overlap ||
            (b.m.years_experience ?? 0) - (a.m.years_experience ?? 0)
        );
      const recommended = scored.map((s) => s.m).slice(0, 4);

      // Ascending order for "next session" calculations.
      const ascSessions = [...sessions].sort((a, b) =>
        a.scheduled_at.localeCompare(b.scheduled_at)
      );

      return {
        sessions: ascSessions,
        feedback: (fbRes.data as DashFeedback[] | null) ?? [],
        preferredAreas,
        recommended,
      };
    },
  });
};
