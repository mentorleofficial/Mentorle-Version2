import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SessionStatus } from "@/features/mentor-sessions/useMentorSessions";

export interface BookingDetailRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  title: string;
  topic: string;
  notes: string | null;
  mentee_notes: string | null;
  meeting_url: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  mentee_id: string;
  mentor_id: string;
  offering_id: string | null;
  program_id: string | null;
  mentee: { full_name: string; avatar_url: string | null; email: string } | null;
  offering: { id: string; title: string; price: number | null; currency: string | null; category: string | null } | null;
  program: { id: string; name: string; color: string; slug: string } | null;
  feedback: {
    rating: number;
    comment: string | null;
    audience: string;
    response?: string | null;
    responded_at?: string | null;
  }[];
}

export const bookingDetailKey = (bookingId?: string) =>
  ["mentor", "booking-detail", bookingId] as const;

export function useBookingDetail(bookingId?: string) {
  return useQuery({
    queryKey: bookingDetailKey(bookingId),
    enabled: !!bookingId,
    staleTime: 30_000,
    queryFn: async (): Promise<BookingDetailRow> => {
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "id, scheduled_at, duration_minutes, status, title, topic, notes, mentee_notes, meeting_url, cancellation_reason, cancelled_at, mentee_id, mentor_id, offering_id, program_id, mentee:users!sessions_mentee_id_fkey(full_name, avatar_url, email), offering:mentorship_offerings(id, title, price, currency, category), program:programs(id, name, color, slug), feedback(rating, comment, audience, response, responded_at)"
        )
        .eq("id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Booking not found");
      return data as unknown as BookingDetailRow;
    },
  });
}
