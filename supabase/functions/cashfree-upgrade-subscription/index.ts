// Upgrades an active monthly Mentorle Plus membership to yearly:
// cancels the current Cashfree subscription, ends the old membership, then starts
// a new yearly pending membership + Cashfree subscription session (same checkout flow).
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
    const userName =
      ((userData.user.user_metadata as Record<string, unknown>)?.full_name as string) ?? "Member";

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body.plan_id) return json({ error: "plan_id is required" }, 400);

    const { data: yearlyPlan } = await admin
      .from("subscription_plans")
      .select("id, name, interval, price, currency, max_amount, is_active")
      .eq("id", body.plan_id)
      .maybeSingle();
    if (!yearlyPlan || !yearlyPlan.is_active || yearlyPlan.interval !== "year") {
      return json({ error: "Yearly plan not found or inactive" }, 404);
    }

    const { data: current } = await admin
      .from("memberships")
      .select("id, cashfree_subscription_id, status, plan_id, subscription_plans(interval)")
      .eq("user_id", userId)
      .in("status", ["active", "past_due"])
      .maybeSingle();
    if (!current) return json({ error: "No active membership to upgrade" }, 404);

    const currentInterval =
      (current.subscription_plans as { interval?: string } | null)?.interval ?? null;
    if (currentInterval !== "month") {
      return json({ error: "Only monthly memberships can be upgraded to yearly" }, 400);
    }

    // Cancel Cashfree monthly subscription first
    if (current.cashfree_subscription_id) {
      const cfCancel = await fetch(
        `${cashfreeBase()}/subscriptions/${current.cashfree_subscription_id}/manage`,
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
      const cancelData = await cfCancel.json().catch(() => ({}));
      if (!cfCancel.ok) {
        console.error("cashfree-upgrade cancel failed:", cfCancel.status, JSON.stringify(cancelData));
        const cfMsg = (cancelData?.message as string) || JSON.stringify(cancelData).slice(0, 300);
        return json({ error: "Cashfree: " + cfMsg, details: cancelData }, 502);
      }
    }

    await admin
      .from("memberships")
      .update({
        status: "cancelled",
        auto_renew: false,
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    // Clear any abandoned pending attempt
    await admin
      .from("memberships")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");

    const price = Number(yearlyPlan.price);
    const maxAmount = yearlyPlan.max_amount != null ? Number(yearlyPlan.max_amount) : price;
    const maxCycles = 10;
    const planName =
      (yearlyPlan.name || "Mentorle Plus").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 50) ||
      "Mentorle Plus";

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + maxCycles + 1);
    const firstCharge = new Date(now);
    firstCharge.setDate(firstCharge.getDate() + 1);

    const { data: membership, error: mErr } = await admin
      .from("memberships")
      .insert({
        user_id: userId,
        plan_id: yearlyPlan.id,
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
    if (mErr || !membership) {
      return json({ error: "Failed to create yearly membership: " + (mErr?.message ?? "") }, 500);
    }

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
          plan_interval_type: "YEAR",
          plan_intervals: 1,
          plan_max_cycles: maxCycles,
        },
        authorization_details: {
          authorization_amount: 1,
          authorization_amount_refund: true,
          payment_methods: ["upi", "card"],
        },
        subscription_meta: body.return_url ? { return_url: body.return_url } : {},
        subscription_first_charge_time: firstCharge.toISOString(),
        subscription_expiry_time: expiry.toISOString(),
      }),
    });
    const cfData = await cfRes.json().catch(() => ({}));
    if (!cfRes.ok || !cfData.subscription_session_id) {
      console.error("cashfree-upgrade-subscription failed:", cfRes.status, JSON.stringify(cfData));
      await admin.from("memberships").update({ status: "cancelled" }).eq("id", membership.id);
      const cfMsg =
        (cfData?.message as string) ||
        (cfData?.error?.message as string) ||
        (typeof cfData?.error === "string" ? cfData.error : "") ||
        JSON.stringify(cfData).slice(0, 300);
      return json({ error: "Cashfree: " + cfMsg, details: cfData }, 502);
    }

    await admin
      .from("memberships")
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
