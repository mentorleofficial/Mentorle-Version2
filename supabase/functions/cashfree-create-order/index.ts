// Creates a Cashfree order for a one-time charge: a paid 1:1 session, a paid event, or a plan pass (Pro Pass…).
// Everything that decides the price is worked out here, never taken from the caller:
//   session     prepare_paid_session() checks the mentee, the offering and that the time is an open slot, and
//               gives the price and length; the slot is held for 15 minutes while they pay.
//   event       the event's price; refused when full, past, or already registered.
//   membership  the plan's price (one-time plans only); refused while a pass is active, except in its last
//               30 days (then it extends the pass).
// Members get their plan's session / event discount (the mentor is still paid on the full price).
// Records a `payments` row and returns the payment_session_id for Cashfree's checkout.
import { cashfree, cashfreeKeys, cashfreeMode, corsHeaders, json, serviceClient } from "../_shared/payments.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

interface Payload {
  kind: "session" | "event" | "membership";
  offering_id?: string;
  scheduled_at?: string;
  notes?: string;
  program_id?: string | null;
  event_id?: string;
  plan_id?: string;
  return_url?: string;
}

const RENEW_WINDOW_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!cashfreeKeys()) return json({ error: "Cashfree is not configured" }, 500);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const admin = serviceClient();

    const body = (await req.json().catch(() => ({}))) as Payload;
    const { data: isMentee } = await admin.rpc("has_role", { _user_id: userId, _role: "mentee" });
    if (!isMentee) return json({ error: "Only mentee accounts can buy sessions, events or passes" }, 403);

    // Back to the page that started checkout (same site only); Cashfree fills in {order_id}.
    const origin = req.headers.get("Origin") ?? "";
    const returnUrl = body.return_url && origin && body.return_url.startsWith(`${origin}/`) ? body.return_url : undefined;

    const { data: memberRows } = await admin.rpc("active_membership", { _user_id: userId });
    const member =
      (memberRows as { session_discount: number; event_discount: number; plan_id: string; plan_name: string; period_end: string | null }[] | null)?.[0] ?? null;

    let listPrice = 0;
    let discount = 0;
    let referenceId: string | null = null;
    let details: Record<string, unknown> = {};
    let hold: { mentorId: string; scheduledAt: string; duration: number } | null = null;
    let note = "Mentorle";

    if (body.kind === "session") {
      if (!body.offering_id || !body.scheduled_at) return json({ error: "offering_id and scheduled_at are required" }, 400);
      const { data, error } = await admin.rpc("prepare_paid_session", { _user_id: userId, _offering_id: body.offering_id, _scheduled_at: body.scheduled_at });
      if (error) return json({ error: error.message, code: error.code }, error.code === "23P01" ? 409 : 400);
      const offer = (data as { mentor_id: string; title: string; duration_minutes: number; price: number }[])[0];
      listPrice = Number(offer.price);
      discount = Number(member?.session_discount ?? 0);
      referenceId = body.offering_id;
      details = {
        booking: { offering_id: body.offering_id, scheduled_at: body.scheduled_at, notes: (body.notes ?? "").slice(0, 2000), program_id: body.program_id ?? null, mentor_id: offer.mentor_id },
      };
      hold = { mentorId: offer.mentor_id, scheduledAt: body.scheduled_at, duration: offer.duration_minutes };
      note = `Mentorle session: ${offer.title}`.slice(0, 200);
    } else if (body.kind === "event") {
      if (!body.event_id) return json({ error: "event_id is required" }, 400);
      const { data: ev } = await admin
        .from("events_programs")
        .select("id, title, price, created_by, status, start_date, registration_deadline, max_participants, participant_count")
        .eq("id", body.event_id)
        .maybeSingle();
      if (!ev || ev.status === "cancelled" || ev.status === "completed") return json({ error: "This event isn't open for registration" }, 404);
      if (ev.start_date && new Date(ev.start_date) < new Date()) return json({ error: "This event has already started" }, 409);
      if (ev.registration_deadline && new Date(ev.registration_deadline) < new Date()) return json({ error: "Registration for this event has closed" }, 409);
      if (Number(ev.price ?? 0) <= 0) return json({ error: "This event is free: register without checkout" }, 400);
      if (ev.max_participants && (ev.participant_count ?? 0) >= ev.max_participants) return json({ error: "This event is full" }, 409);
      const { data: already } = await admin.from("event_participants").select("id").eq("event_id", ev.id).eq("user_id", userId).maybeSingle();
      if (already) return json({ error: "You're already registered for this event" }, 409);
      listPrice = Number(ev.price);
      discount = Number(member?.event_discount ?? 0);
      referenceId = ev.id;
      details = { event: { event_id: ev.id, mentor_id: ev.created_by } };
      note = `Mentorle event: ${ev.title ?? ""}`.slice(0, 200);
    } else if (body.kind === "membership") {
      if (!body.plan_id) return json({ error: "plan_id is required" }, 400);
      const { data: plan } = await admin.from("subscription_plans").select("id, name, price, billing, is_active").eq("id", body.plan_id).maybeSingle();
      if (!plan || !plan.is_active || plan.billing !== "one_time" || Number(plan.price) <= 0) return json({ error: "This plan can't be bought right now" }, 404);
      if (member?.period_end) {
        const renewable = member.plan_id === plan.id && new Date(member.period_end).getTime() - Date.now() < RENEW_WINDOW_DAYS * 86_400_000;
        if (!renewable) return json({ error: `You already have ${member.plan_name} until ${new Date(member.period_end).toDateString()}`, code: "ALREADY_MEMBER" }, 409);
      }
      listPrice = Number(plan.price);
      referenceId = plan.id;
      details = { plan: { plan_id: plan.id, name: plan.name } };
      note = `Mentorle ${plan.name}`.slice(0, 200);
    } else {
      return json({ error: "Unknown kind" }, 400);
    }

    const amount = discount > 0 ? Math.round(listPrice * (1 - discount / 100) * 100) / 100 : listPrice;
    const { data: profile } = await admin.from("mentee_profiles").select("phone").eq("user_id", userId).maybeSingle();
    const phone = (profile?.phone ?? "").replace(/\D/g, "").slice(-10) || "9999999999";
    const orderId = `mtl_${body.kind}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const payload = { ...details, original_amount: listPrice, discount_percent: discount };

    const { data: pay, error: payErr } = await admin
      .from("payments")
      .insert({ user_id: userId, kind: body.kind, reference_id: referenceId, cashfree_order_id: orderId, amount, currency: "INR", status: "created", payload })
      .select("id")
      .single();
    if (payErr || !pay) return json({ error: "Couldn't start the payment" }, 500);

    if (hold) {
      const { data: holdId, error: holdErr } = await admin.rpc("reserve_slot", {
        _mentor_id: hold.mentorId,
        _mentee_id: userId,
        _scheduled_at: hold.scheduledAt,
        _duration: hold.duration,
        _payment_id: pay.id,
        _ttl_minutes: 15,
      });
      if (holdErr || !holdId) {
        await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
        return json({ error: "That time is no longer available. Please pick another.", code: "23P01" }, 409);
      }
    }

    const order = await cashfree("/orders", {
      method: "POST",
      body: {
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: { customer_id: userId, customer_email: userData.user.email ?? "", customer_phone: phone },
        order_meta: returnUrl ? { return_url: returnUrl } : {},
        order_note: note,
      },
    });
    if (!order.ok || !order.data.payment_session_id) {
      await admin.from("slot_holds").delete().eq("payment_id", pay.id);
      await admin.from("payments").update({ status: "failed", payload: { ...payload, cashfree: order.data } }).eq("id", pay.id);
      return json({ error: "Couldn't start the payment with Cashfree" }, 502);
    }
    await admin.from("payments").update({ cashfree_payment_session_id: order.data.payment_session_id, status: "pending", updated_at: new Date().toISOString() }).eq("id", pay.id);

    return json({ order_id: orderId, payment_session_id: order.data.payment_session_id, cashfree_mode: cashfreeMode(), amount, original_amount: listPrice, discount_percent: discount });
  } catch (e) {
    console.error("cashfree-create-order", e);
    return json({ error: "Something went wrong starting the payment" }, 500);
  }
});
