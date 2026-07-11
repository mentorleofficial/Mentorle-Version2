// Sync queued outbound events to EduBridge with HMAC-SHA256 signing.
// Admin-triggered. Processes a batch of pending/failed events and updates their status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BATCH = 25;
const MAX_ATTEMPTS = 5;

const hmacSign = async (secret: string, body: string) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SECRET = Deno.env.get("EDUBRIDGE_WEBHOOK_SECRET") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branding } = await admin
      .from("branding")
      .select("edubridge_webhook_url, edubridge_enabled")
      .limit(1).maybeSingle();

    if (!branding?.edubridge_enabled || !branding.edubridge_webhook_url) {
      return new Response(JSON.stringify({ ok: false, error: "EduBridge sync is not enabled or webhook URL is missing." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const defaultTarget = branding.edubridge_webhook_url;

    const { data: pending } = await admin
      .from("outbound_events")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH);

    let sent = 0, failed = 0;

    for (const ev of pending ?? []) {
      const target = ev.target_url || defaultTarget;
      const body = JSON.stringify({
        id: ev.id,
        event_type: ev.event_type,
        payload: ev.payload,
        created_at: ev.created_at,
      });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (SECRET) headers["X-Signature-256"] = `sha256=${await hmacSign(SECRET, body)}`;

      try {
        const res = await fetch(target, { method: "POST", headers, body });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        await admin.from("outbound_events").update({
          status: "sent",
          attempts: ev.attempts + 1,
          last_error: "",
          sent_at: new Date().toISOString(),
        }).eq("id", ev.id);
        sent++;
      } catch (e) {
        await admin.from("outbound_events").update({
          status: "failed",
          attempts: ev.attempts + 1,
          last_error: String((e as Error).message ?? e).slice(0, 500),
        }).eq("id", ev.id);
        failed++;
      }
    }

    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "sync_to_edubridge",
      entity_type: "outbound_events",
      entity_id: "",
      details: { sent, failed, batch: (pending ?? []).length },
    });

    return new Response(JSON.stringify({ ok: true, sent, failed, batch: (pending ?? []).length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
