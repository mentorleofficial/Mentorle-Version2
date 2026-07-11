import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActionItemStatus = "open" | "done";

export interface ActionItemAttachment {
  name: string;
  url: string;
}

export interface ActionItem {
  id: string;
  session_id: string;
  mentor_id: string;
  mentee_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: ActionItemStatus;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  mentor_attachments: ActionItemAttachment[];
  mentee_attachments: ActionItemAttachment[];
}

export const sessionActionItemsKey = (sessionId?: string) =>
  ["session-action-items", sessionId] as const;

export const userOpenActionItemsKey = (userId?: string, side?: "mentor" | "mentee") =>
  ["user-open-action-items", side, userId] as const;

export function useSessionActionItems(sessionId?: string) {
  return useQuery({
    queryKey: sessionActionItemsKey(sessionId),
    enabled: !!sessionId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_action_items")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ActionItem[];
    },
  });
}

/** Open items count for a user (mentor or mentee side) — used in dashboards. */
export function useOpenActionItemsCount(
  userId: string | undefined,
  side: "mentor" | "mentee"
) {
  return useQuery({
    queryKey: userOpenActionItemsKey(userId, side),
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const column = side === "mentor" ? "mentor_id" : "mentee_id";
      const { count, error } = await supabase
        .from("session_action_items")
        .select("id", { count: "exact", head: true })
        .eq(column, userId!)
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface CreateActionItemInput {
  session_id: string;
  mentor_id: string;
  mentee_id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  created_by: string;
  mentor_attachments?: ActionItemAttachment[];
}

export function useCreateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateActionItemInput) => {
      const { data, error } = await supabase
        .from("session_action_items")
        .insert({
          session_id: input.session_id,
          mentor_id: input.mentor_id,
          mentee_id: input.mentee_id,
          title: input.title,
          description: input.description ?? "",
          due_date: input.due_date ?? null,
          created_by: input.created_by,
          mentor_attachments: input.mentor_attachments ?? [],
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ActionItem;
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: sessionActionItemsKey(item.session_id) });
      qc.invalidateQueries({ queryKey: userOpenActionItemsKey(item.mentor_id, "mentor") });
      qc.invalidateQueries({ queryKey: userOpenActionItemsKey(item.mentee_id, "mentee") });
      qc.invalidateQueries({ queryKey: ["mentee-tasks", item.mentee_id] });
    },
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      session_id: string;
      patch: Partial<ActionItem>;
    }) => {
      const { data, error } = await supabase
        .from("session_action_items")
        .update(input.patch as any)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ActionItem;
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: sessionActionItemsKey(item.session_id) });
      qc.invalidateQueries({ queryKey: userOpenActionItemsKey(item.mentor_id, "mentor") });
      qc.invalidateQueries({ queryKey: userOpenActionItemsKey(item.mentee_id, "mentee") });
      qc.invalidateQueries({ queryKey: ["mentee-tasks", item.mentee_id] });
    },
  });
}

export function useDeleteActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; session_id: string; mentor_id: string; mentee_id: string }) => {
      const { error } = await supabase
        .from("session_action_items")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: sessionActionItemsKey(input.session_id) });
      qc.invalidateQueries({ queryKey: userOpenActionItemsKey(input.mentor_id, "mentor") });
      qc.invalidateQueries({ queryKey: userOpenActionItemsKey(input.mentee_id, "mentee") });
      qc.invalidateQueries({ queryKey: ["mentee-tasks", input.mentee_id] });
    },
  });
}

export function useToggleActionItem() {
  const update = useUpdateActionItem();
  return (item: ActionItem) =>
    update.mutateAsync({
      id: item.id,
      session_id: item.session_id,
      patch: {
        status: item.status === "open" ? "done" : "open",
        completed_at: item.status === "open" ? new Date().toISOString() : null,
      },
    });
}

/** Returns a Set of session IDs that have at least one action item assigned to the mentee. */
export function useMenteeActionItemSessionIds(menteeId?: string) {
  return useQuery({
    queryKey: ["mentee-action-item-sessions", menteeId],
    enabled: !!menteeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_action_items")
        .select("session_id")
        .eq("mentee_id", menteeId!);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.session_id as string));
    },
  });
}
