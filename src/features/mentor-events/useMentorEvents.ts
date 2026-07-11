import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMentorEvents,
  fetchAllEvents,
  createMentorEvent,
  updateMentorEvent,
  deleteMentorEvent,
  fetchEventParticipants,
  registerForEvent,
  unregisterFromEvent,
  type EventProgram,
} from "./api/events";

export const mentorEventsKey = (mentorId?: string) =>
  ["mentor", "events", mentorId] as const;

export const eventParticipantsKey = (eventId?: string) =>
  ["mentor", "event-participants", eventId] as const;

export function useMentorEvents(mentorId?: string) {
  return useQuery({
    queryKey: mentorEventsKey(mentorId),
    enabled: !!mentorId,
    staleTime: 30_000,
    queryFn: () => fetchMentorEvents(mentorId!),
  });
}

export function useAllEvents() {
  return useQuery({
    queryKey: ["admin", "events"],
    staleTime: 30_000,
    queryFn: () => fetchAllEvents(),
  });
}

export function useMenteeRegistrations(userId?: string) {
  return useQuery({
    queryKey: ["mentee", "registrations", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_participants")
        .select("event_id, registered_at, completion_status, progress_data")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as { event_id: string; registered_at: string; completion_status: string | null; progress_data: any }[];
    }
  });
}

export function useEventParticipants(eventId?: string) {
  return useQuery({
    queryKey: eventParticipantsKey(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
    queryFn: () => fetchEventParticipants(eventId!),
  });
}

export function useMentorEventsMutations(mentorId?: string, isAdmin = false) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: mentorEventsKey(mentorId) });
    qc.invalidateQueries({ queryKey: ["admin", "events"] });
    // Also invalidate availability since events update availability calendar
    qc.invalidateQueries({ queryKey: ["mentor", "availability", mentorId] });
  };

  const createMutation = useMutation({
    mutationFn: (eventData: Omit<EventProgram, "id" | "created_at" | "updated_at" | "created_by">) =>
      createMentorEvent(eventData, mentorId!),
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Event created successfully!" });
    },
    onError: (error: any) => {
      console.error("Create event error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create event",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; data: Partial<EventProgram> }) =>
      updateMentorEvent(input.id, input.data, mentorId!, isAdmin),
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Event updated successfully!" });
    },
    onError: (error: any) => {
      console.error("Update event error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update event",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteMentorEvent(eventId, mentorId!, isAdmin),
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Event deleted successfully!" });
    },
    onError: (error: any) => {
      console.error("Delete event error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete event",
      });
    },
  });

  return {
    createEvent: createMutation,
    updateEvent: updateMutation,
    deleteEvent: deleteMutation,
  };
}

export function useRegisterForEvent(userId?: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (eventId: string) => registerForEvent(eventId, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentee", "registrations", userId] });
      qc.invalidateQueries({ queryKey: ["mentor", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      toast({ title: "Success", description: "Registered for event successfully!" });
    },
    onError: (error: any) => {
      console.error("Register event error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to register for event",
      });
    },
  });
}

export function useUnregisterFromEvent(userId?: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (eventId: string) => unregisterFromEvent(eventId, userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentee", "registrations", userId] });
      qc.invalidateQueries({ queryKey: ["mentor", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      toast({ title: "Success", description: "Unregistered from event successfully!" });
    },
    onError: (error: any) => {
      console.error("Unregister event error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to unregister from event",
      });
    },
  });
}
