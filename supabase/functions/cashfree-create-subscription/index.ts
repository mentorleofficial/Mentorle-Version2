// Starts a Mentorle Plus subscription via Cashfree PG Subscriptions (UPI/card e-mandate,
// x-api-version 2025-01-01, same credentials as the Orders API). Uses INLINE plan_details so
// pricing stays dynamic (read from our DB at subscribe time — no Cashfree Plans to pre-create).
// plan_max_amount is the mandate ceiling (headroom) so prices can be raised for active members
// later without re-auth, up to that ceiling. Records a `pending` membership; the subscription
// webhook flips it to `active` once the customer approves the mandate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isProd = () => (Deno.env.get("CASHFREE_ENV") ?? "sandbox") === "production";
const cashfreeBase = () => (isProd() ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

interface Payload {
  plan_id: string;
  return_url?: string;
}

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
    if (!CF_APP_ID || !CF_SECRET) return json({ error: "Cashfree is not configured" }, 500);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";
    const userName = (userData.user.user_metadata as Record<string, unknown>)?.full_name as string ?? "Member";

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body.plan_id) return json({ error: "plan_id is required" }, 400);

    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id, name, interval, price, currency, max_amount, is_active")
      .eq("id", body.plan_id)
      .maybeSingle();
    if (!plan || !plan.is_active) return json({ error: "Plan not found or inactive" }, 404);

    // Block only on a real (active/past_due) membership — no stacking.
    const { data: active } = await admin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["active", "past_due"])
      .maybeSingle();
    if (active) return json({ error: "You already have an active membership" }, 409);

    // Clear any abandoned pending attempt (mandate never completed) so a fresh one can start.
    await admin
      .from("memberships")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    const isYear = plan.interval === "year";
    const price = Number(plan.price);
    const maxAmount = plan.max_amount != null ? Number(plan.max_amount) : price;
    const maxCycles = isYear ? 10 : 120; // ~10 years
    // Cashfree plan_name allows only alphanumerics + a few specials (no parentheses).
    const planName = (plan.name || "Mentorle Plus").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 50) || "Mentorle Plus";

    const now = new Date();
    const periodEnd = new Date(now);
    if (isYear) periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
    const expiry = new Date(now);
    if (isYear) expiry.setFullYear(expiry.getFullYear() + maxCycles + 1);
    else expiry.setMonth(expiry.getMonth() + maxCycles + 1);
    // Cashfree rejects a same-day first charge — the earliest allowed is the next day.
    const firstCharge = new Date(now);
    firstCharge.setDate(firstCharge.getDate() + 1);

    const { data: membership, error: mErr } = await admin
      .from("memberships")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        status: "pending",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        quota_anchor_day: now.getUTCDate(),
        auto_renew: true,
        mandate_max_amount: maxAmount,
      })
      .select("id")
      .single();
    if (mErr || !membership) return json({ error: "Failed to create membership: " + (mErr?.message ?? "") }, 500);

    const { data: mp } = await admin.from("mentee_profiles").select("phone").eq("user_id", userId).maybeSingle();
    const phone = ((mp?.phone ?? "").replace(/\D/g, "").slice(-10)) || "9999999999";

    const subscriptionId = `mtlsub_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

    const cfRes = await fetch(`${cashfreeBase()}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2025-01-01",
        "x-client-id": CF_APP_ID,
        "x-client-secret": CF_SECRET,
      },
      body: JSON.stringify({
        subscription_id: subscriptionId,
        customer_details: { customer_name: userName, customer_email: userEmail, customer_phone: phone },
        plan_details: {
          plan_name: planName,
          plan_type: "PERIODIC",
          plan_amount: price,
          plan_max_amount: maxAmount,
          plan_currency: "INR",
          plan_interval_type: isYear ? "YEAR" : "MONTH",
          plan_intervals: 1,
          plan_max_cycles: maxCycles,
        },
        authorization_details: {
          authorization_amount: 1,
          authorization_amount_refund: true,
          payment_methods: ["upi", "card"],
        },
        subscription_meta: body.return_url ? { return_url: body.return_url } : {},
        subscription_first_charge_time: firstCharge.toISOString(), // earliest Cashfree allows (next day)
        subscription_expiry_time: expiry.toISOString(),
      }),
    });
    const cfData = await cfRes.json().catch(() => ({}));
    if (!cfRes.ok || !cfData.subscription_session_id) {
      console.error("cashfree-create-subscription failed:", cfRes.status, JSON.stringify(cfData));
      await admin.from("memberships").update({ status: "cancelled" }).eq("id", membership.id);
      const cfMsg =
        (cfData?.message as string) ||
        (cfData?.error?.message as string) ||
        (typeof cfData?.error === "string" ? cfData.error : "") ||
        JSON.stringify(cfData).slice(0, 300);
      return json({ error: "Cashfree: " + cfMsg, details: cfData }, 502);
    }

    await admin.from("memberships")
      .update({ cashfree_subscription_id: subscriptionId, updated_at: new Date().toISOString() })
      .eq("id", membership.id);

    return json({
      membership_id: membership.id,
      subscription_id: subscriptionId,
      subscription_session_id: cfData.subscription_session_id,
      cashfree_mode: isProd() ? "production" : "sandbox",
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
