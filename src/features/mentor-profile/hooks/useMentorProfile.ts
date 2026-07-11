import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMentorProfile, updateMentorProfile, updateGlobalAttachmentToggle } from "../api/mentorProfile";
import type { MentorProfileFormValues } from "../schema";

export const mentorProfileKey = (userId: string) => ["mentor-profile", userId] as const;

export function useMentorProfile(userId: string | undefined) {
  return useQuery({
    queryKey: mentorProfileKey(userId ?? "anon"),
    queryFn: () => fetchMentorProfile(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useUpdateMentorProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: MentorProfileFormValues & { avatar_url?: string | null; resume_url?: string }) =>
      updateMentorProfile(userId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mentorProfileKey(userId) });
    },
  });
}

export function useUpdateGlobalAttachmentToggle(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allow: boolean) => updateGlobalAttachmentToggle(userId, allow),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mentorProfileKey(userId) });
    },
  });
}
