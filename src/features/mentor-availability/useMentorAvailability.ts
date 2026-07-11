import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWeeklySlots,
  fetchOverrides,
  fetchTimezone,
  updateTimezone,
  fetchAvailabilitySettings,
  updateAvailabilitySettings,
  addSlot,
  updateSlot,
  deleteSlot,
  deleteSlotsForDay,
  copySlotsToDays,
  addOverride,
  deleteOverride,
  fetchMentorEvents,
  type WeeklySlot,
  type DateOverride,
  type CalendarEvent,
} from "@/features/availability/api/availability";

export const mentorAvailabilityKey = (userId?: string) =>
  ["mentor", "availability", userId] as const;

export interface MentorAvailabilityData {
  slots: WeeklySlot[];
  overrides: DateOverride[];
  timezone: string;
  buffer_time_minutes: number;
  minimum_notice_hours: number;
  events: CalendarEvent[];
}

export function useMentorAvailability(userId?: string) {
  return useQuery({
    queryKey: mentorAvailabilityKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MentorAvailabilityData> => {
      const [slots, overrides, settings, events] = await Promise.all([
        fetchWeeklySlots(userId!),
        fetchOverrides(userId!),
        fetchAvailabilitySettings(userId!),
        fetchMentorEvents(userId!),
      ]);
      return {
        slots,
        overrides,
        timezone: settings.timezone,
        buffer_time_minutes: settings.buffer_time_minutes,
        minimum_notice_hours: settings.minimum_notice_hours,
        events,
      };
    },
  });
}

export function useAvailabilityMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: mentorAvailabilityKey(userId) });

  return {
    addSlot: useMutation({
      mutationFn: (input: { day_of_week: number; start_time: string; end_time: string }) =>
        addSlot({ ...input, mentor_id: userId! }),
      onSuccess: invalidate,
    }),
    updateSlot: useMutation({
      mutationFn: (input: { id: string; patch: { start_time?: string; end_time?: string } }) =>
        updateSlot(input.id, input.patch),
      onSuccess: invalidate,
    }),
    deleteSlot: useMutation({
      mutationFn: (id: string) => deleteSlot(id),
      onSuccess: invalidate,
    }),
    deleteSlotsForDay: useMutation({
      mutationFn: (day: number) => deleteSlotsForDay(userId!, day),
      onSuccess: invalidate,
    }),
    copySlotsToDays: useMutation({
      mutationFn: (input: {
        sourceSlots: { start_time: string; end_time: string }[];
        targetDays: number[];
      }) => copySlotsToDays(userId!, input.sourceSlots, input.targetDays),
      onSuccess: invalidate,
    }),
    updateTimezone: useMutation({
      mutationFn: (tz: string) => updateTimezone(userId!, tz),
      onSuccess: invalidate,
    }),
    updateSettings: useMutation({
      mutationFn: (patch: { timezone?: string; buffer_time_minutes?: number; minimum_notice_hours?: number }) =>
        updateAvailabilitySettings(userId!, patch),
      onSuccess: invalidate,
    }),
    addOverride: useMutation({
      mutationFn: (input: Omit<DateOverride, "id" | "mentor_id">) =>
        addOverride({ ...input, mentor_id: userId! }),
      onSuccess: invalidate,
    }),
    deleteOverride: useMutation({
      mutationFn: (id: string) => deleteOverride(id),
      onSuccess: invalidate,
    }),
  };
}
