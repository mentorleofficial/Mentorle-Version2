import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMenteeProfile } from "../api";

export const menteeProfileKey = (userId: string) => ["mentee-profile", userId] as const;

export function useMenteeProfile(userId: string | undefined) {
  return useQuery({
    queryKey: menteeProfileKey(userId ?? "anon"),
    queryFn: () => fetchMenteeProfile(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useMenteeProfileStatus(userId: string | undefined) {
  const q = useMenteeProfile(userId);
  return {
    // Treat "no user yet" / disabled query as loading so guards don't
    // briefly think the profile is incomplete during auth hydration.
    loading: !userId || q.isPending,
    isComplete: !!q.data?.onboarded_at,
    data: q.data,
  };
}

export function useInvalidateMenteeProfile() {
  const qc = useQueryClient();
  return (userId: string) => qc.invalidateQueries({ queryKey: menteeProfileKey(userId) });
}
