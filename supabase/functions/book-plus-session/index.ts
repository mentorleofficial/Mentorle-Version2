// Free Plus booking — does NOT touch Cashfree. Sessions go through book_plus_session() as the mentee (open
// slot, eligible offering, the plan's free sessions, all in one transaction). Events still register here and
// use a free session through consume_plus_session(), rolling the registration back when none are left.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Payload {
  kind: "session" | "event";
  offering_id?: string;
  event_id?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  title?: string;
  topic?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as Payload;

    if (body.kind === "event") {
      if (!body.event_id) return json({ error: "event_id is required" }, 400);
      const { data: ev } = await admin
        .from("events_programs")
        .select("id, created_by, plus_eligible, price, max_participants, participant_count")
        .eq("id", body.event_id)
        .maybeSingle();
      if (!ev) return json({ error: "Event not found" }, 404);
      if (!ev.plus_eligible) return json({ error: "This event is not available under Plus" }, 400);
      if (ev.max_participants && (ev.participant_count ?? 0) >= ev.max_participants) {
        return json({ error: "This event is full" }, 409);
      }

      const { data: reg, error: regErr } = await admin
        .from("event_participants")
        .insert({ event_id: ev.id, user_id: userId, registered_at: new Date().toISOString() })
        .select("id")
        .single();
      if (regErr || !reg) return json({ error: "Failed to register: " + (regErr?.message ?? "") }, 500);

      const { data: usageId, error: rpcErr } = await admin.rpc("consume_plus_session", {
        _user_id: userId,
        _kind: "event",
        _mentor_id: ev.created_by,
        _reference_id: reg.id,
        _list_price: Number(ev.price ?? 0),
      });
      if (rpcErr) {
        await admin.from("event_participants").delete().eq("id", reg.id); // roll back the registration
        const msg = rpcErr.message ?? "";
        if (msg.includes("QUOTA_EXHAUSTED")) return json({ error: "Your monthly Plus sessions are used up" }, 409);
        if (msg.includes("NO_ACTIVE_MEMBERSHIP")) return json({ error: "No active Plus membership" }, 403);
        return json({ error: "Could not register with Plus: " + msg }, 500);
      }
      return json({ registration_id: reg.id, usage_id: usageId });
    }

    if (!body.offering_id || !body.scheduled_at) return json({ error: "offering_id and scheduled_at are required" }, 400);
    const { data: booked, error: bookErr } = await userClient.rpc("book_plus_session", {
      _offering_id: body.offering_id,
      _scheduled_at: body.scheduled_at,
      _notes: body.notes ?? "",
      _program_id: null,
    });
    if (bookErr) {
      const msg = bookErr.message ?? "";
      if (msg.includes("QUOTA_EXHAUSTED")) return json({ error: "Your free Plus sessions are used up" }, 409);
      if (msg.includes("NO_ACTIVE_MEMBERSHIP")) return json({ error: "No active Plus membership" }, 403);
      return json({ error: msg || "Could not book Plus session" }, bookErr.code === "23P01" ? 409 : 400);
    }
    const row = (booked as { session_id: string; meeting_url: string }[])[0];
    return json({ session_id: row.session_id, meeting_url: row.meeting_url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
