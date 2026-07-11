import { supabase } from "@/integrations/supabase/client";

export interface WeeklySlot {
  id: string;
  mentor_id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
  is_recurring: boolean;
}

export interface DateOverride {
  id: string;
  mentor_id: string;
  date: string; // YYYY-MM-DD
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
}

export async function fetchWeeklySlots(mentorId: string): Promise<WeeklySlot[]> {
  const { data, error } = await supabase
    .from("mentor_availability")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;
  return (data ?? []) as WeeklySlot[];
}

export async function fetchOverrides(mentorId: string): Promise<DateOverride[]> {
  const { data, error } = await supabase
    .from("mentor_availability_overrides")
    .select("*")
    .eq("mentor_id", mentorId)
    .order("date");
  if (error) throw error;
  return (data ?? []) as DateOverride[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  start_date: string;
  end_date: string;
  sessions: any[] | null;
  status: string;
}

export async function fetchMentorEvents(mentorId: string): Promise<CalendarEvent[]> {
  const [eventsResult, sessionsResult] = await Promise.all([
    supabase
      .from("events_programs" as any)
      .select("id, title, description, event_type, start_date, end_date, sessions, status")
      .eq("created_by", mentorId)
      .neq("status", "cancelled"),
    supabase
      .from("sessions")
      .select("id, title, topic, scheduled_at, duration_minutes, status")
      .eq("mentor_id", mentorId)
      .eq("status", "booked")
  ]);

  if (eventsResult.error) throw eventsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  const events = (eventsResult.data ?? []) as unknown as CalendarEvent[];
  
  const mappedSessions = (sessionsResult.data ?? []).map((s): CalendarEvent => {
    const start = new Date(s.scheduled_at);
    const end = new Date(start.getTime() + (s.duration_minutes || 60) * 60 * 1000);
    return {
      id: s.id,
      title: s.title || "Booked Session",
      description: s.topic || "Mentorship Session",
      event_type: "session",
      start_date: s.scheduled_at,
      end_date: end.toISOString(),
      sessions: null,
      status: s.status,
    };
  });

  return [...events, ...mappedSessions];
}

export interface AvailabilitySettings {
  timezone: string;
  buffer_time_minutes: number;
  minimum_notice_hours: number;
}

export async function fetchAvailabilitySettings(mentorId: string): Promise<AvailabilitySettings> {
  const { data, error } = await supabase
    .from("mentor_profiles")
    .select("timezone, buffer_time_minutes, minimum_notice_hours")
    .eq("user_id", mentorId)
    .maybeSingle();
  if (error) throw error;
  return {
    timezone: data?.timezone ?? "Asia/Kolkata",
    buffer_time_minutes: data?.buffer_time_minutes ?? 0,
    minimum_notice_hours: data?.minimum_notice_hours ?? 0,
  };
}

export async function fetchTimezone(mentorId: string): Promise<string> {
  const { timezone } = await fetchAvailabilitySettings(mentorId);
  return timezone;
}

export async function updateAvailabilitySettings(
  mentorId: string,
  patch: { timezone?: string; buffer_time_minutes?: number; minimum_notice_hours?: number }
) {
  const { error } = await supabase
    .from("mentor_profiles")
    .update(patch)
    .eq("user_id", mentorId);
  if (error) throw error;
}

export async function updateTimezone(mentorId: string, timezone: string) {
  await updateAvailabilitySettings(mentorId, { timezone });
}

export async function addSlot(input: {
  mentor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}) {
  const { data, error } = await supabase
    .from("mentor_availability")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as WeeklySlot;
}

export async function updateSlot(
  id: string,
  patch: { start_time?: string; end_time?: string }
) {
  const { error } = await supabase.from("mentor_availability").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id: string) {
  const { error } = await supabase.from("mentor_availability").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteSlotsForDay(mentorId: string, dayOfWeek: number) {
  const { error } = await supabase
    .from("mentor_availability")
    .delete()
    .eq("mentor_id", mentorId)
    .eq("day_of_week", dayOfWeek);
  if (error) throw error;
}

export async function copySlotsToDays(
  mentorId: string,
  sourceSlots: { start_time: string; end_time: string }[],
  targetDays: number[]
) {
  // Wipe target days first to keep them in sync
  for (const day of targetDays) {
    await deleteSlotsForDay(mentorId, day);
  }
  const rows = targetDays.flatMap((day) =>
    sourceSlots.map((s) => ({
      mentor_id: mentorId,
      day_of_week: day,
      start_time: s.start_time,
      end_time: s.end_time,
    }))
  );
  if (rows.length === 0) return;
  const { error } = await supabase.from("mentor_availability").insert(rows);
  if (error) throw error;
}

export async function addOverride(input: Omit<DateOverride, "id">) {
  const { data, error } = await supabase
    .from("mentor_availability_overrides")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as DateOverride;
}

export async function deleteOverride(id: string) {
  const { error } = await supabase
    .from("mentor_availability_overrides")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
