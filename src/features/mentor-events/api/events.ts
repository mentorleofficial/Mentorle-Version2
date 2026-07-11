import { supabase } from "@/integrations/supabase/client";

export interface EventSession {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  meeting_link?: string;
}

export interface EventProgram {
  id: string;
  title: string;
  description: string;
  event_type: string; // 'workshop', 'bootcamp', 'guest_session', 'event', 'other'
  college_name: string;
  location: string;
  start_date: string;
  end_date: string;
  start_time: string;
  meeting_link: string | null;
  status: string; // 'upcoming', 'ongoing', 'completed', 'cancelled'
  banner_image_url: string | null;
  sessions: EventSession[];
  max_participants: number | null;
  registration_deadline: string | null;
  registration_link: string | null;
  prerequisites: string | null;
  learning_outcomes: string | null;
  speaker_name: string | null;
  speaker_linkedin: string | null;
  speaker_github: string | null;
  speaker_image: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  participant_count?: number;
}

export interface EventParticipant {
  id: string;
  registered_at: string;
  user_profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

// Fetch events created by the current mentor
export async function fetchMentorEvents(mentorUserId: string): Promise<EventProgram[]> {
  const { data: events, error } = await supabase
    .from("events_programs" as any)
    .select("*")
    .eq("created_by", mentorUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (events || []) as unknown as EventProgram[];
}

// Fetch all events (for admin and mentee listings)
export async function fetchAllEvents(): Promise<EventProgram[]> {
  const { data: events, error } = await supabase
    .from("events_programs" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (events || []) as unknown as EventProgram[];
}

// Create a new event
export async function createMentorEvent(eventData: Omit<EventProgram, "id" | "created_at" | "updated_at" | "created_by">, mentorUserId: string): Promise<EventProgram> {
  const { data, error } = await supabase
    .from("events_programs" as any)
    .insert([{
      ...eventData,
      created_by: mentorUserId,
      college_name: eventData.college_name || "Online"
    }])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as EventProgram;
}

// Update an existing event
export async function updateMentorEvent(eventId: string, eventData: Partial<EventProgram>, mentorUserId: string, isAdmin = false): Promise<EventProgram> {
  // First verify ownership unless admin
  if (!isAdmin) {
    const { data: existing, error: checkError } = await supabase
      .from("events_programs" as any)
      .select("created_by")
      .eq("id", eventId)
      .single();

    if (checkError) throw checkError;
    if ((existing as any).created_by !== mentorUserId) {
      throw new Error("You can only edit your own events");
    }
  }

  const { data, error } = await supabase
    .from("events_programs" as any)
    .update(eventData)
    .eq("id", eventId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as EventProgram;
}

// Delete an event
export async function deleteMentorEvent(eventId: string, mentorUserId: string, isAdmin = false): Promise<void> {
  // First verify ownership unless admin
  if (!isAdmin) {
    const { data: existing, error: checkError } = await supabase
      .from("events_programs" as any)
      .select("created_by")
      .eq("id", eventId)
      .single();

    if (checkError) throw checkError;
    if ((existing as any).created_by !== mentorUserId) {
      throw new Error("You can only delete your own events");
    }
  }

  const { error } = await supabase
    .from("events_programs" as any)
    .delete()
    .eq("id", eventId);

  if (error) throw error;
}

// Register a user (mentee) for an event
export async function registerForEvent(eventId: string, userId: string): Promise<void> {
  // Check event capacity
  const { data: event, error: eventError } = await supabase
    .from("events_programs" as any)
    .select("max_participants, participant_count")
    .eq("id", eventId)
    .single();

  if (eventError) throw eventError;

  const ev = event as { max_participants?: number | null; participant_count?: number | null } | null;
  if (ev && ev.max_participants) {
    if ((ev.participant_count ?? 0) >= ev.max_participants) {
      throw new Error("This event is full. Registration is no longer available.");
    }
  }

  const { error } = await supabase
    .from("event_participants" as any)
    .insert({
      event_id: eventId,
      user_id: userId,
      registered_at: new Date().toISOString()
    });

  if (error) throw error;
}

// Unregister a user (mentee) from an event
export async function unregisterFromEvent(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("event_participants" as any)
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) throw error;
}

// Upload event banner image
export async function uploadEventBanner(file: File, eventId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${eventId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("event-banners")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("event-banners")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Delete event banner from storage
export async function deleteEventBanner(bannerUrl: string): Promise<void> {
  if (!bannerUrl) return;
  
  const path = bannerUrl.split("/event-banners/")[1];
  if (!path) return;

  const { error } = await supabase.storage
    .from("event-banners")
    .remove([path]);

  if (error) throw error;
}

// Fetch event participants
export async function fetchEventParticipants(eventId: string): Promise<EventParticipant[]> {
  const { data, error } = await supabase
    .from("event_participants" as any)
    .select(`
      id,
      registered_at,
      user_profiles:users (
        full_name,
        email
      )
    `)
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as EventParticipant[];
}
