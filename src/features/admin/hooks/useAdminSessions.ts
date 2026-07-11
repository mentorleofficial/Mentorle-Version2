import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SessionStatus = Database["public"]["Enums"]["session_status"];

export interface AdminSessionFilters {
  status?: SessionStatus | "all";
  programId?: string | null;
  from?: string | null; // ISO date
  to?: string | null;
  search?: string; // matches mentor or mentee full name
}

export interface AdminSessionRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  notes: string | null;
  mentee_notes: string;
  meeting_url: string;
  cancellation_reason: string;
  cancelled_at: string | null;
  mentor_id: string;
  mentee_id: string;
  mentor: { id: string; full_name: string; email: string } | null;
  mentee: { id: string; full_name: string; email: string } | null;
}

export const useAdminSessions = (filters: AdminSessionFilters) => {
  return useQuery({
    queryKey: ["admin-sessions", filters],
    queryFn: async () => {
      let query = supabase
        .from("sessions")
        .select(
          `id, scheduled_at, duration_minutes, status, notes, mentee_notes, meeting_url,
           cancellation_reason, cancelled_at, mentor_id, mentee_id,
           mentor:users!sessions_mentor_id_fkey(id, full_name, email),
           mentee:users!sessions_mentee_id_fkey(id, full_name, email)`,
        )
        .order("scheduled_at", { ascending: false })
        .limit(500);

      if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.from) query = query.gte("scheduled_at", filters.from);
      if (filters.to) query = query.lte("scheduled_at", filters.to);

      const { data, error } = await query;
      if (error) throw error;
      let rows = (data as any as AdminSessionRow[]) || [];

      if (filters.programId) {
        // Restrict to sessions where the mentor belongs to that program
        const { data: pm } = await supabase
          .from("program_mentors")
          .select("mentor_id")
          .eq("program_id", filters.programId);
        const allowed = new Set((pm || []).map((p: any) => p.mentor_id));
        rows = rows.filter((r) => allowed.has(r.mentor_id));
      }

      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.mentor?.full_name?.toLowerCase().includes(q) ||
            r.mentee?.full_name?.toLowerCase().includes(q) ||
            r.mentor?.email?.toLowerCase().includes(q) ||
            r.mentee?.email?.toLowerCase().includes(q),
        );
      }
      return rows;
    },
  });
};

export interface AdminSessionStats {
  upcoming: number;
  completed30: number;
  cancelled30: number;
  noShow30: number;
  avgRating: number | null;
}

export const useAdminSessionStats = () => {
  return useQuery({
    queryKey: ["admin-session-stats"],
    queryFn: async (): Promise<AdminSessionStats> => {
      const nowIso = new Date().toISOString();
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [upRes, compRes, cancRes, nsRes, fbRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "booked").gte("scheduled_at", nowIso),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed").gte("scheduled_at", since),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("scheduled_at", since),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "no_show").gte("scheduled_at", since),
        supabase.from("feedback").select("rating"),
      ]);
      const ratings = (fbRes.data || []).map((r: any) => r.rating);
      return {
        upcoming: upRes.count || 0,
        completed30: compRes.count || 0,
        cancelled30: cancRes.count || 0,
        noShow30: nsRes.count || 0,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      };
    },
  });
};
