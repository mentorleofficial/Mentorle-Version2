import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Mentor or admin moves a booked session to a new time (reschedule_session() checks who may, clashes and the
// time), then emails both people the new time. Mentees can't reschedule.
export function useRescheduleSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; scheduledAt: Date }) => {
      const { error } = await supabase.rpc("reschedule_session", {
        _session_id: input.sessionId,
        _scheduled_at: input.scheduledAt.toISOString(),
      });
      if (error) throw error;
      // Sends once per move; a failed email doesn't undo the move.
      supabase.functions.invoke("send-booking-email", { body: { sessionId: input.sessionId, kind: "rescheduled" } }).catch(() => {});
      return input;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["mentor"] });
      qc.invalidateQueries({ queryKey: ["admin-sessions"] });
      qc.invalidateQueries({ queryKey: ["admin-session-stats"] });
    },
  });
}

// The mentor's open times on one IST day for this session's offering (the session's own slot counts as free).
export function useRescheduleOpenTimes(offeringId: string | null | undefined, day: string, sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["reschedule-open-times", offeringId, day, sessionId],
    enabled: enabled && !!offeringId && !!day,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mentor_open_slots", {
        _offering_id: offeringId!,
        _from: day,
        _days: 1,
        _ignore_session_id: sessionId,
      });
      if (error) throw error;
      return (data ?? []).map((row) => row.starts_at);
    },
  });
}
