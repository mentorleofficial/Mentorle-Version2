import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ActionItem } from "./useActionItems";

export interface MenteeTaskRow extends ActionItem {
  session: {
    id: string;
    title: string | null;
    scheduled_at: string | null;
  } | null;
  mentor: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export const menteeTasksKey = (menteeId?: string) => ["mentee-tasks", menteeId] as const;

export function useMenteeTasks(menteeId?: string) {
  return useQuery({
    queryKey: menteeTasksKey(menteeId),
    enabled: !!menteeId,
    staleTime: 30_000,
    queryFn: async (): Promise<MenteeTaskRow[]> => {
      const { data: items, error } = await supabase
        .from("session_action_items")
        .select("*")
        .eq("mentee_id", menteeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (items ?? []) as unknown as ActionItem[];
      if (rows.length === 0) return [];

      const sessionIds = Array.from(new Set(rows.map((r) => r.session_id).filter(Boolean)));
      const mentorIds = Array.from(new Set(rows.map((r) => r.mentor_id).filter(Boolean)));

      const [sessRes, userRes] = await Promise.all([
        sessionIds.length
          ? supabase.from("sessions").select("id, title, scheduled_at").in("id", sessionIds)
          : Promise.resolve({ data: [], error: null } as any),
        mentorIds.length
          ? supabase.from("users").select("id, full_name, avatar_url").in("id", mentorIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const sessionById: Record<string, any> = {};
      (sessRes.data ?? []).forEach((s: any) => (sessionById[s.id] = s));
      const userById: Record<string, any> = {};
      (userRes.data ?? []).forEach((u: any) => (userById[u.id] = u));

      return rows.map((r) => ({
        ...r,
        session: sessionById[r.session_id] ?? null,
        mentor: userById[r.mentor_id] ?? null,
      }));
    },
  });
}
