import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { menteeSessionsKey } from "@/features/mentee-sessions/useMenteeSessions";

export interface BookingMentor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  current_role: string | null;
  current_organization: string | null;
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
  linkedin_url: string | null;
}
export interface BookingSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}
export interface BookingOverride {
  id: string;
  date: string;
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
}
export interface BookingMentorProfile {
  is_active: boolean;
  timezone: string;
  buffer_time_minutes: number;
  minimum_notice_hours: number;
  cancellation_notice_hours: number;
  allow_reschedule: boolean;
  reschedule_notice_hours: number;
}
export interface BookingOffering {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string;
  plus_eligible: boolean;
}
export interface BookSessionStaticData {
  mentor: BookingMentor | null;
  slots: BookingSlot[];
  mentorProfile: BookingMentorProfile | null;
  overrides: BookingOverride[];
  offerings: BookingOffering[];
}

export interface BookedTime {
  scheduled_at: string;
  duration_minutes: number;
}

export const bookSessionStaticKey = (mentorId?: string) =>
  ["book-session", "static", mentorId] as const;
export const bookSessionBookedKey = (mentorId?: string, excludeSessionId?: string | null) =>
  ["book-session", "booked-times", mentorId, excludeSessionId] as const;

/**
 * Mentor + availability + overrides + offerings — stable, cached across visits.
 */
export function useBookSessionStatic(mentorId?: string) {
  return useQuery<BookSessionStaticData>({
    queryKey: bookSessionStaticKey(mentorId),
    enabled: !!mentorId,
    staleTime: 60_000,
    queryFn: async () => {
      const todayDate = new Date().toISOString().slice(0, 10);
      const [bookingInfoRes, slotsRes, ovRes, offeringsRes] = await Promise.all([
        supabase.rpc("get_mentor_booking_info", { _mentor_id: mentorId! }),
        supabase
          .from("mentor_availability")
          .select("id, day_of_week, start_time, end_time")
          .eq("mentor_id", mentorId!)
          .order("day_of_week"),
        supabase
          .from("mentor_availability_overrides")
          .select("id, date, is_unavailable, start_time, end_time")
          .eq("mentor_id", mentorId!)
          .gte("date", todayDate)
          .order("date"),
        supabase
          .from("mentorship_offerings")
          .select("id, title, description, duration_minutes, price, category, plus_eligible")
          .eq("mentor_id", mentorId!)
          .eq("status", "active")
          .order("duration_minutes"),
      ]);

      const info = Array.isArray(bookingInfoRes.data) && bookingInfoRes.data.length ? bookingInfoRes.data[0] : null;

      return {
        mentor: info
          ? {
            id: info.id,
            full_name: info.full_name,
            avatar_url: info.avatar_url,
            headline: (info as any).headline ?? null,
            current_role: (info as any).current_role ?? null,
            current_organization: (info as any).current_organization ?? null,
            bio: (info as any).bio ?? null,
            expertise: (info as any).expertise ?? null,
            years_experience: (info as any).years_experience ?? null,
            linkedin_url: (info as any).linkedin_url ?? null,
          }
          : null,
        mentorProfile: info
          ? {
            is_active: info.is_active,
            timezone: info.timezone,
            buffer_time_minutes: info.buffer_time_minutes,
            minimum_notice_hours: info.minimum_notice_hours,
            cancellation_notice_hours: info.cancellation_notice_hours ?? 0,
            allow_reschedule: info.allow_reschedule ?? true,
            reschedule_notice_hours: info.reschedule_notice_hours ?? 0,
          }
          : null,
        slots: (slotsRes.data as BookingSlot[] | null) ?? [],
        overrides: (ovRes.data as BookingOverride[] | null) ?? [],
        offerings: (offeringsRes.data as BookingOffering[] | null) ?? [],
      };
    },
  });
}

/**
 * Booked times — invalidated after a successful booking.
 */
export function useBookedTimes(mentorId?: string, excludeSessionId?: string | null) {
  return useQuery<BookedTime[]>({
    queryKey: bookSessionBookedKey(mentorId, excludeSessionId),
    enabled: !!mentorId,
    staleTime: 30_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 90);

      const { data, error } = await supabase.rpc("get_booked_times", {
        _mentor_id: mentorId!,
      });
      if (error) throw error;

      interface BookedTimeRow { id: string; scheduled_at: string; duration_minutes: number }
      let list = (data ?? []) as BookedTimeRow[];
      if (excludeSessionId) {
        list = list.filter((item) => item.id !== excludeSessionId);
      }

      return list
        .filter((item) => item.scheduled_at >= nowIso && item.scheduled_at <= horizon.toISOString())
        .map((item) => ({
          scheduled_at: item.scheduled_at,
          duration_minutes: item.duration_minutes,
        }));
    },
  });
}

export interface BookSessionInput {
  mentorId: string;
  menteeId: string;
  scheduledAt: Date;
  durationMinutes: number;
  notes: string;
  title: string;
  topic?: string;
  rescheduleId?: string | null;
  offeringId?: string | null;
  programId?: string | null;
}
export interface BookSessionResult {
  sessionId: string;
  meetingUrl: string;
}

export function useBookSession() {
  const qc = useQueryClient();
  return useMutation<BookSessionResult, Error, BookSessionInput>({
    // book_session() checks the offering (free unless rescheduling), the time (an open slot), onboarding and
    // the mentor's reschedule rules, and sets the length, title and meeting link (the mentor's own or Jitsi).
    // It also cancels the original when rescheduling. Mentees can't insert sessions directly.
    mutationFn: async (input) => {
      if (!input.offeringId) throw new Error("Choose a session type to book");
      const { data, error } = await supabase.rpc("book_session", {
        _offering_id: input.offeringId,
        _scheduled_at: input.scheduledAt.toISOString(),
        _notes: input.notes ?? "",
        _program_id: input.programId ?? null,
        _reschedule_from: input.rescheduleId ?? null,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) throw error || new Error("Booking failed");
      return { sessionId: row.session_id, meetingUrl: row.meeting_url };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: bookSessionBookedKey(vars.mentorId, vars.rescheduleId) });
      qc.invalidateQueries({ queryKey: menteeSessionsKey(vars.menteeId) });
      qc.invalidateQueries({ queryKey: ["mentee-dashboard", vars.menteeId] });
      qc.invalidateQueries({ queryKey: ["mentor", "sessions", vars.mentorId] });
      qc.invalidateQueries({ queryKey: ["mentor", "dashboard", vars.mentorId] });
    },
  });
}
