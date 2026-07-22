// Free Plus booking — does NOT touch Cashfree. Enforces the 2/month quota atomically:
// creates the session, then calls consume_plus_session() which locks the membership row,
// re-checks quota, and writes the usage ledger + mentor earning in one transaction.
// If quota is exhausted the pre-created session is rolled back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

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

    if (body.kind !== "session") {
      // Event Plus-consumption is scaffolded (events.plus_price + event_participants insert)
      // and wired up alongside the events booking flow.
      return json({ error: "Only 'session' Plus booking is implemented in the foundation" }, 501);
    }

    if (!body.offering_id) return json({ error: "offering_id is required" }, 400);
    const { data: off } = await admin
      .from("mentorship_offerings")
      .select("id, price, mentor_id, plus_eligible, status")
      .eq("id", body.offering_id)
      .maybeSingle();
    if (!off) return json({ error: "Offering not found" }, 404);
    if (!off.plus_eligible) return json({ error: "This offering is not available under Plus" }, 400);

    const meetingId = crypto.randomUUID();
    const { data: sess, error: sessErr } = await admin.from("sessions").insert({
      mentor_id: off.mentor_id,
      mentee_id: userId,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes,
      mentee_notes: body.notes ?? "",
      title: body.title ?? "Plus session",
      topic: body.topic ?? "",
      meeting_url: `https://meet.jit.si/mentorle-${meetingId}`,
      offering_id: off.id,
    }).select("id").single();
    if (sessErr || !sess) return json({ error: "Failed to create session: " + (sessErr?.message ?? "") }, 500);

    const { data: usageId, error: rpcErr } = await admin.rpc("consume_plus_session", {
      _user_id: userId,
      _kind: "session",
      _mentor_id: off.mentor_id,
      _reference_id: sess.id,
      _list_price: Number(off.price ?? 0),
    });

    if (rpcErr) {
      await admin.from("sessions").delete().eq("id", sess.id); // roll back the pre-created session
      const msg = rpcErr.message ?? "";
      if (msg.includes("QUOTA_EXHAUSTED")) return json({ error: "Your monthly Plus sessions are used up" }, 409);
      if (msg.includes("NO_ACTIVE_MEMBERSHIP")) return json({ error: "No active Plus membership" }, 403);
      return json({ error: "Could not book Plus session: " + msg }, 500);
    }

    return json({ session_id: sess.id, usage_id: usageId, meeting_url: `https://meet.jit.si/mentorle-${meetingId}` });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
