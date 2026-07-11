import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Badge = {
  id: string;
  code: string;
  name: string;
  tier: "bronze" | "silver" | "gold";
  description: string;
  icon_url: string;
};

export type MentorBadge = {
  id: string;
  mentor_id: string;
  badge_id: string;
  awarded_at: string;
  awarded_reason: string;
  badge: Badge;
};

export type LeaderboardRow = {
  mentor_id: string;
  completed_sessions_30d: number;
  avg_rating_30d: number;
  mentee_count_30d: number;
  score: number;
  computed_at: string;
  mentor: { id: string; full_name: string; avatar_url: string | null } | null;
};

export const badgesKey = ["badges"] as const;
export const mentorBadgesKey = (mentorId?: string) => ["mentor-badges", mentorId ?? "anon"] as const;
export const leaderboardKey = ["mentor-leaderboard"] as const;

export function useBadges() {
  return useQuery({
    queryKey: badgesKey,
    queryFn: async (): Promise<Badge[]> => {
      const { data, error } = await supabase
        .from("badges")
        .select("id, code, name, tier, description, icon_url")
        .eq("is_active", true);
      if (error) throw error;
      return (data as Badge[]) ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useMentorBadges(mentorId?: string) {
  return useQuery({
    queryKey: mentorBadgesKey(mentorId),
    enabled: !!mentorId,
    queryFn: async (): Promise<MentorBadge[]> => {
      const { data, error } = await supabase
        .from("mentor_badges")
        .select("id, mentor_id, badge_id, awarded_at, awarded_reason, badge:badges(id, code, name, tier, description, icon_url)")
        .eq("mentor_id", mentorId!)
        .order("awarded_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as MentorBadge[]) ?? [];
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: leaderboardKey,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase
        .from("mentor_leaderboard_stats")
        .select("mentor_id, completed_sessions_30d, avg_rating_30d, mentee_count_30d, score, computed_at")
        .order("score", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as Omit<LeaderboardRow, "mentor">[];
      if (!rows.length) return [];
      // list_public_mentors already filters is_active = true — use it as the active-mentor allowlist
      const { data: users } = await supabase.rpc("list_public_mentors");
      const byId = new Map((users ?? []).map((u: any) => [u.user_id, { id: u.user_id, full_name: u.full_name, avatar_url: u.avatar_url }]));
      // Only include rows whose mentor is in the active list
      return rows
        .filter((r) => byId.has(r.mentor_id))
        .map((r) => ({ ...r, mentor: byId.get(r.mentor_id) ?? null }));
    },
    staleTime: 60_000,
  });
}

export function useRefreshEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("refresh-mentor-engagement");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leaderboardKey });
      qc.invalidateQueries({ queryKey: ["mentor-badges"] });
    },
  });
}
