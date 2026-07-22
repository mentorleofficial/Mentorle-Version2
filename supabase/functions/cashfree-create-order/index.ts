// Creates a Cashfree PG order for a one-time charge (paid 1:1 session; event/addon later).
// The amount is derived server-side from the offering — a client-sent price is never trusted.
// Records a `payments` row (service role) and returns the payment_session_id for the checkout SDK.
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
  kind: "session" | "event" | "addon";
  offering_id?: string;
  mentor_id?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  title?: string;
  topic?: string;
  notes?: string;
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as Payload;

    let amount = 0;
    let referenceId: string | null = null;
    let bookingMentorId = body.mentor_id ?? null;

    if (body.kind === "session") {
      if (!body.offering_id) return json({ error: "offering_id is required" }, 400);
      if (!body.scheduled_at || !body.duration_minutes) {
        return json({ error: "scheduled_at and duration_minutes are required" }, 400);
      }
      const { data: off } = await admin
        .from("mentorship_offerings")
        .select("id, price, mentor_id, status")
        .eq("id", body.offering_id)
        .maybeSingle();
      if (!off) return json({ error: "Offering not found" }, 404);
      amount = Number(off.price ?? 0);
      referenceId = off.id;
      bookingMentorId = off.mentor_id;
      if (amount <= 0) return json({ error: "Offering is free — no payment required" }, 400);
    } else {
      return json({ error: `kind '${body.kind}' is not supported yet` }, 400);
    }

    const { data: mp } = await admin
      .from("mentee_profiles").select("phone").eq("user_id", userId).maybeSingle();
    const phone = ((mp?.phone ?? "").replace(/\D/g, "").slice(-10)) || "9999999999";

    const orderId = `mtl_${body.kind}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

    const { data: pay, error: payErr } = await admin
      .from("payments")
      .insert({
        user_id: userId,
        kind: body.kind,
        reference_id: referenceId,
        cashfree_order_id: orderId,
        amount,
        currency: "INR",
        status: "created",
        payload: {
          booking: body.kind === "session"
            ? {
              mentor_id: bookingMentorId,
              mentee_id: userId,
              scheduled_at: body.scheduled_at,
              duration_minutes: body.duration_minutes,
              title: body.title ?? "Session",
              topic: body.topic ?? "",
              notes: body.notes ?? "",
              offering_id: body.offering_id,
            }
            : null,
        },
      })
      .select("id")
      .single();
    if (payErr || !pay) return json({ error: "Failed to record payment: " + (payErr?.message ?? "") }, 500);

    // Hold the slot for the payment window so a concurrent paid booking can't take it.
    const { data: holdId, error: holdErr } = await admin.rpc("reserve_slot", {
      _mentor_id: bookingMentorId,
      _mentee_id: userId,
      _scheduled_at: body.scheduled_at,
      _duration: body.duration_minutes,
      _payment_id: pay.id,
      _ttl_minutes: 15,
    });
    if (holdErr) {
      await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
      return json({ error: "Could not reserve the slot: " + holdErr.message }, 500);
    }
    if (!holdId) {
      await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
      return json({ error: "That slot was just taken — please pick another time." }, 409);
    }

    const cfRes = await fetch(`${cashfreeBase()}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": CF_APP_ID,
        "x-client-secret": CF_SECRET,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: { customer_id: userId, customer_email: userEmail, customer_phone: phone },
        order_meta: body.return_url ? { return_url: body.return_url } : {},
        order_note: `Mentorle ${body.kind}`,
      }),
    });
    const cfData = await cfRes.json().catch(() => ({}));
    if (!cfRes.ok || !cfData.payment_session_id) {
      await admin.from("slot_holds").delete().eq("id", holdId);
      await admin.from("payments").update({ status: "failed", payload: cfData }).eq("id", pay.id);
      return json({ error: "Cashfree order creation failed", details: cfData }, 502);
    }

    await admin.from("payments").update({
      cashfree_payment_session_id: cfData.payment_session_id,
      status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", pay.id);

    return json({
      order_id: orderId,
      payment_session_id: cfData.payment_session_id,
      cashfree_mode: isProd() ? "production" : "sandbox",
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
