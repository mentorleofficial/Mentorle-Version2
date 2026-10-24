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
  // Public page on mentorle.in: /events/<slug>. Generated from the title when left empty (database trigger).
  slug: string;
  subtitle: string | null;
  highlights: string[];
  description: string;
  event_type: string; // 'workshop', 'bootcamp', 'guest_session', 'event', 'other'
  college_name: string;
  location: string;
  start_date: string;
  end_date: string;
  start_time: string;
  meeting_link: string | null;
  status: string; // 'upcoming', 'ongoing', 'completed', 'cancelled'
  price: number;
  plus_eligible: boolean;
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

// Meeting links live in the private event_meeting_links table (migration 20261024130000): the public
// events_programs row never carries them. This merges in the links the caller may see (admins, the event's
// creator, registered attendees). Saving still writes meeting_link on the event (and on each session); a
// database trigger moves it into the private table. "" clears a link, null leaves it unchanged.
async function attachMeetingLinks(events: EventProgram[]): Promise<EventProgram[]> {
  if (!events.length) return events;
  const { data, error } = await supabase.rpc("get_event_meeting_links", { _event_ids: events.map((event) => event.id) });
  if (error) {
    // Migration not applied yet: links are still on the event rows themselves.
    if (error.code === "PGRST202") return events;
    // Anything else: fail loudly. Showing the forms with blank links would let a save wipe them.
    throw error;
  }
  const links = new Map((data ?? []).map((row) => [row.event_id, row]));
  return events.map((event) => {
    const row = links.get(event.id);
    if (!row) return event;
    const sessionLinks = (row.session_links ?? {}) as Record<string, string>;
    return {
      ...event,
      meeting_link: row.meeting_link,
      sessions: (event.sessions ?? []).map((session) => (sessionLinks[session.id] ? { ...session, meeting_link: sessionLinks[session.id] } : session)),
    };
  });
}

// Event web addresses (mentorle.in/events/<slug>): lowercase letters and digits joined by single hyphens.
export const EVENT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const EVENT_SLUG_MAX = 80;

// Same rules as the database's generate_event_slug(), for the form's preview.
export const slugifyEventTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 70)
    .replace(/-+$/, "") || "event";

// True when no other event uses this address. events_programs is publicly readable, so this works for anyone.
export async function isEventSlugAvailable(slug: string, excludeEventId?: string): Promise<boolean> {
  let query = supabase.from("events_programs").select("id").eq("slug", slug).limit(1);
  if (excludeEventId) query = query.neq("id", excludeEventId);
  const { data, error } = await query;
  if (error) throw error;
  return !data?.length;
}

// Fetch events created by the current mentor
export async function fetchMentorEvents(mentorUserId: string): Promise<EventProgram[]> {
  const { data: events, error } = await supabase
    .from("events_programs" as any)
    .select("*")
    .eq("created_by", mentorUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return attachMeetingLinks((events || []) as unknown as EventProgram[]);
}

// Fetch all events (for admin and mentee listings)
export async function fetchAllEvents(): Promise<EventProgram[]> {
  const { data: events, error } = await supabase
    .from("events_programs" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return attachMeetingLinks((events || []) as unknown as EventProgram[]);
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
  return (await attachMeetingLinks([data as unknown as EventProgram]))[0];
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
  return (await attachMeetingLinks([data as unknown as EventProgram]))[0];
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
async function fetchEventParticipantsDirect(eventId: string): Promise<EventParticipant[]> {
  const { data: rows, error } = await supabase
    .from("event_participants")
    .select("id, registered_at, user_id")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });

  if (error) throw error;
  if (!rows?.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const userMap = new Map<string, { full_name: string | null; email: string | null }>();

  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", userIds);

    if (usersError) throw usersError;
    for (const user of users ?? []) {
      userMap.set(user.id, { full_name: user.full_name, email: user.email });
    }
  }

  return rows.map((row) => ({
    id: row.id,
    registered_at: row.registered_at ?? "",
    user_profiles: row.user_id
      ? userMap.get(row.user_id) ?? { full_name: null, email: null }
      : null,
  }));
}

function isMissingParticipantsRpc(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    Boolean(error.message?.includes("get_event_participants"))
  );
}

export async function fetchEventParticipants(eventId: string): Promise<EventParticipant[]> {
  const { data, error } = await supabase.rpc("get_event_participants", {
    _event_id: eventId,
  });

  if (!error) {
    return (data ?? []).map((row) => ({
      id: row.id,
      registered_at: row.registered_at ?? "",
      user_profiles: {
        full_name: row.full_name,
        email: row.email,
      },
    }));
  }

  // RPC not deployed yet — fall back to direct queries (works for admin/event creator RLS).
  if (isMissingParticipantsRpc(error)) {
    return fetchEventParticipantsDirect(eventId);
  }

  throw error;
}
