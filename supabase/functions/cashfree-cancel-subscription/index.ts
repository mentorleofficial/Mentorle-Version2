// Cancels a member's Cashfree subscription (stops auto-renew) and marks the membership cancelled.
// Cashfree manage endpoint: POST /pg/subscriptions/{subscription_id}/manage { action: "CANCEL" }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isProd = () => (Deno.env.get("CASHFREE_ENV") ?? "sandbox") === "production";
const cashfreeBase = () => (isProd() ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CF_APP_ID = Deno.env.get("CASHFREE_APP_ID");
    const CF_SECRET = Deno.env.get("CASHFREE_SECRET_KEY");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as { at_period_end?: boolean };
    const atPeriodEnd = body.at_period_end === true;

    const { data: m } = await admin
      .from("memberships")
      .select("id, cashfree_subscription_id, status")
      .eq("user_id", userId)
      .in("status", ["active", "past_due", "pending"])
      .maybeSingle();
    if (!m) return json({ error: "No active membership to cancel" }, 404);

    if (m.cashfree_subscription_id && CF_APP_ID && CF_SECRET) {
      const cfRes = await fetch(
        `${cashfreeBase()}/subscriptions/${m.cashfree_subscription_id}/manage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-version": "2025-01-01",
            "x-client-id": CF_APP_ID,
            "x-client-secret": CF_SECRET,
          },
          body: JSON.stringify({ action: "CANCEL" }),
        },
      );
      const cfData = await cfRes.json().catch(() => ({}));
      if (!cfRes.ok) {
        console.error("cashfree-cancel-subscription failed:", cfRes.status, JSON.stringify(cfData));
        const cfMsg = (cfData?.message as string) || JSON.stringify(cfData).slice(0, 300);
        return json({ error: "Cashfree: " + cfMsg, details: cfData }, 502);
      }
    }

    // "End now" cancels immediately; "at period end" keeps access (status active) until the
    // period ends — the expiry cron flips it to expired, and the webhook won't downgrade it early.
    await admin
      .from("memberships")
      .update(
        atPeriodEnd
          ? { auto_renew: false, cancel_at_period_end: true, updated_at: new Date().toISOString() }
          : { status: "cancelled", auto_renew: false, cancel_at_period_end: true, updated_at: new Date().toISOString() },
      )
      .eq("id", m.id);

    return json({ ok: true, at_period_end: atPeriodEnd });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
