import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { menteeSessionsKey } from "@/features/mentee-sessions/useMenteeSessions";

export interface BookingMentor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
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
}
export interface BookingOffering {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string;
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
          .select("id, title, description, duration_minutes, price, category")
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
            email: info.email,
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
    mutationFn: async (input) => {
      const meetingId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      const meetingUrl = `https://meet.jit.si/mentorle-${meetingId}`;

      const { data: inserted, error } = await supabase
        .from("sessions")
        .insert({
          mentor_id: input.mentorId,
          mentee_id: input.menteeId,
          scheduled_at: input.scheduledAt.toISOString(),
          duration_minutes: input.durationMinutes,
          mentee_notes: input.notes,
          title: input.title,
          topic: input.topic ?? "",
          meeting_url: meetingUrl,
          offering_id: input.offeringId || null,
          program_id: input.programId || null,
          rescheduled_from_id: input.rescheduleId || null,
        })
        .select("id")
        .single();
      if (error || !inserted) throw error || new Error("Insert failed");

      if (input.rescheduleId) {
        await supabase
          .from("sessions")
          .update({
            status: "cancelled",
            cancelled_by: input.menteeId,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: "Rescheduled",
          })
          .eq("id", input.rescheduleId);
      }

      return { sessionId: inserted.id, meetingUrl };
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
