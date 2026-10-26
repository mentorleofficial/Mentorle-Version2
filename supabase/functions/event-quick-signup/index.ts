// Quick signup while event mode is on (Admin → Event mode): creates a mentee account with no email code, so people at
// the event go straight in. Refuses unless an event is running right now, so normal OTP signup is the only way in
// otherwise. The new account is entered into the event's draw by the database (enter_event_on_signup trigger).
// Limits: one account per email (Supabase), one entry per phone number per event, and a per-network rate limit that is
// generous because a whole venue usually shares one Wi-Fi address.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const RATE_WINDOW_MINUTES = 10;
const RATE_MAX_PER_NETWORK = 120;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_NAMES = ["admin", "mentor", "mentee"];

// Same rule as the signup forms: "+91 9876543210"; India needs 10 digits starting 6–9, other countries 4–15.
const validPhone = (value: string) => {
  const match = value.match(/^\+(\d{1,4})\s(\d+)$/);
  if (!match) return false;
  if (match[1] === "91") return /^[6-9]\d{9}$/.test(match[2]);
  return match[2].length >= 4 && match[2].length <= 15;
};

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Body = { full_name?: string; email?: string; phone?: string; password?: string; terms?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const fullName = (body.full_name ?? "").trim().replace(/\s+/g, " ");
    const email = (body.email ?? "").trim().toLowerCase();
    const phone = (body.phone ?? "").trim();
    const password = body.password ?? "";
    if (fullName.length < 2 || fullName.length > 100 || RESERVED_NAMES.includes(fullName.toLowerCase())) return json({ error: "Enter your full name.", code: "invalid_name" }, 400);
    if (email.length > 255 || !EMAIL_PATTERN.test(email)) return json({ error: "Enter a valid email address.", code: "invalid_email" }, 400);
    if (!validPhone(phone)) return json({ error: "Enter a valid phone number.", code: "invalid_phone" }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Use 8 to 72 characters for your password.", code: "weak_password" }, 400);
    if (body.terms !== true) return json({ error: "Please accept the Terms and Privacy Policy.", code: "terms" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: running } = await admin.from("event_modes").select("id").is("ended_at", null).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).maybeSingle();
    if (!running) return json({ error: "Quick signup isn't available right now.", code: "event_off" }, 403);

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
    const ipHash = await sha256(`mentorle-event:${ip}`);
    const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await admin.from("event_signup_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("created_at", since);
    if ((count ?? 0) >= RATE_MAX_PER_NETWORK) return json({ error: "Too many signups from this network. Please try again in a few minutes.", code: "rate_limited" }, 429);
    await admin.from("event_signup_attempts").insert({ ip_hash: ipHash });

    const normalized = phone.replace(/\D/g, "").slice(-10);
    const { data: samePhone } = await admin.from("event_entries").select("id").eq("event_mode_id", running.id).eq("phone_normalized", normalized).maybeSingle();
    if (samePhone) return json({ error: "This phone number is already registered for the event.", code: "phone_taken" }, 409);

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "mentee", phone, terms_accepted_at: new Date().toISOString(), event_mode_id: running.id },
      app_metadata: { role: "mentee" },
    });
    if (error || !created.user) {
      const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
      if (message.includes("already") || message.includes("exists") || message.includes("registered"))
        return json({ error: "There's already an account with this email. Log in instead.", code: "email_taken" }, 409);
      if (message.includes("password")) return json({ error: "Choose a stronger password.", code: "weak_password" }, 400);
      console.error("event-quick-signup createUser", error);
      return json({ error: "Couldn't create your account. Please try again.", code: "unknown" }, 500);
    }

    // Same as normal signup: the phone goes to the mentee profile (date of birth is asked in the profile later).
    const { error: profileError } = await admin.from("mentee_profiles").upsert({ user_id: created.user.id, phone }, { onConflict: "user_id" });
    if (profileError) console.error("event-quick-signup mentee_profiles", profileError);

    const { data: entry } = await admin.from("event_entries").select("id").eq("event_mode_id", running.id).eq("user_id", created.user.id).maybeSingle();
    return json({ ok: true, entered: Boolean(entry) });
  } catch (e) {
    console.error("event-quick-signup", e);
    return json({ error: "Couldn't create your account. Please try again.", code: "unknown" }, 500);
  }
});
