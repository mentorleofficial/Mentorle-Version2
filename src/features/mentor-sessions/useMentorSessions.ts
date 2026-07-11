import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SessionStatus = Database["public"]["Enums"]["session_status"];

export interface MentorSessionRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  title: string;
  topic: string;
  notes: string | null;
  mentee_notes: string;
  meeting_url: string;
  cancellation_reason: string;
  mentee_id: string;
  cancelled_at: string | null;
  offering_id: string | null;
  mentee: { full_name: string; avatar_url: string | null } | null;
  program_id: string | null;
  program: { id: string; name: string; color: string; slug: string } | null;
  feedback?: {
    rating: number;
    comment: string | null;
    audience: string;
    response?: string | null;
    responded_at?: string | null;
  }[];
}

export const mentorSessionsKey = (userId?: string) => ["mentor", "sessions", userId] as const;
export const mentorRatedKey = (userId?: string) => ["mentor", "rated-sessions", userId] as const;

async function fetchMentorSessions(userId: string): Promise<MentorSessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, scheduled_at, duration_minutes, status, title, topic, notes, mentee_notes, meeting_url, cancellation_reason, mentee_id, cancelled_at, offering_id, mentee:users!sessions_mentee_id_fkey(full_name, avatar_url), program_id, program:programs(id, name, color, slug), feedback(rating, comment, audience, response, responded_at)"
    )
    .eq("mentor_id", userId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as MentorSessionRow[]) ?? [];
}

export function useMentorSessions(userId?: string) {
  return useQuery({
    queryKey: mentorSessionsKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchMentorSessions(userId!),
  });
}

export function useMentorRatedSessions(userId?: string, sessionIds?: string[]) {
  const enabled = !!userId && !!sessionIds && sessionIds.length > 0;
  return useQuery({
    queryKey: [...mentorRatedKey(userId), sessionIds?.length ?? 0],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("session_id")
        .eq("submitted_by", userId!)
        .eq("audience", "mentee")
        .in("session_id", sessionIds!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.session_id as string));
    },
  });
}

export function useUpdateSessionStatus(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: SessionStatus;
      reason?: string;
    }) => {
      const patch: Record<string, unknown> = { status: input.status };
      if (input.status === "cancelled") {
        patch.cancelled_by = userId;
        patch.cancelled_at = new Date().toISOString();
        patch.cancellation_reason = input.reason || "Cancelled by mentor";
      }
      const { error } = await supabase
        .from("sessions")
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw error;

      if (input.status === "completed") {
        supabase.functions.invoke("send-feedback-request", {
          body: { session_id: input.id },
        }).catch((err) => console.error("send-feedback-request failed:", err));
      }

      return input;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: mentorSessionsKey(userId) });
      const prev = qc.getQueryData<MentorSessionRow[]>(mentorSessionsKey(userId));
      if (prev) {
        qc.setQueryData<MentorSessionRow[]>(
          mentorSessionsKey(userId),
          prev.map((s) =>
            s.id === input.id
              ? {
                  ...s,
                  status: input.status,
                  cancellation_reason:
                    input.status === "cancelled"
                      ? input.reason || "Cancelled by mentor"
                      : s.cancellation_reason,
                  cancelled_at:
                    input.status === "cancelled"
                      ? new Date().toISOString()
                      : s.cancelled_at,
                }
              : s
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(mentorSessionsKey(userId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mentorSessionsKey(userId) });
      qc.invalidateQueries({ queryKey: ["mentor", "dashboard", userId] });
      qc.invalidateQueries({ queryKey: ["mentor", "offering-bookings"] });
      qc.invalidateQueries({ queryKey: ["mentor", "booking-detail"] });
    },
  });
}

export function useUpdateSessionDetails(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      notes: string;
      meeting_url: string;
      title?: string;
      topic?: string;
    }) => {
      const patch: Record<string, unknown> = {
        notes: input.notes,
        meeting_url: input.meeting_url,
      };
      if (input.title !== undefined) patch.title = input.title;
      if (input.topic !== undefined) patch.topic = input.topic;
      const { error } = await supabase
        .from("sessions")
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: mentorSessionsKey(userId) });
      const prev = qc.getQueryData<MentorSessionRow[]>(mentorSessionsKey(userId));
      if (prev) {
        qc.setQueryData<MentorSessionRow[]>(
          mentorSessionsKey(userId),
          prev.map((s) =>
            s.id === input.id
              ? {
                  ...s,
                  notes: input.notes,
                  meeting_url: input.meeting_url,
                  title: input.title ?? s.title,
                  topic: input.topic ?? s.topic,
                }
              : s
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(mentorSessionsKey(userId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mentorSessionsKey(userId) });
      qc.invalidateQueries({ queryKey: ["mentor", "dashboard", userId] });
      qc.invalidateQueries({ queryKey: ["mentor", "booking-detail"] });
    },
  });
}
