import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";

export interface OfferingBookingRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  title: string;
  topic: string;
  mentee_notes: string;
  meeting_url: string;
  cancellation_reason: string;
  mentee_id: string;
  cancelled_at: string | null;
  mentee: { full_name: string; avatar_url: string | null } | null;
}

export const offeringBookingsKey = (offeringId?: string) =>
  ["mentor", "offering-bookings", offeringId] as const;

async function fetchOfferingBookings(
  offeringId: string,
  mentorId: string
): Promise<OfferingBookingRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, scheduled_at, duration_minutes, status, title, topic, mentee_notes, meeting_url, cancellation_reason, mentee_id, cancelled_at, mentee:users!sessions_mentee_id_fkey(full_name, avatar_url)"
    )
    .eq("offering_id", offeringId)
    .eq("mentor_id", mentorId)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as OfferingBookingRow[]) ?? [];
}

export function useOfferingBookings(offeringId?: string, mentorId?: string) {
  return useQuery({
    queryKey: offeringBookingsKey(offeringId),
    enabled: !!offeringId && !!mentorId,
    staleTime: 60_000,
    queryFn: () => fetchOfferingBookings(offeringId!, mentorId!),
  });
}
