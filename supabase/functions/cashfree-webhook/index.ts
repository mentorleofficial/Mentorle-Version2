// Cashfree -> us. The ONLY writer of paid status, session creation on payment, and
// membership activation. Authenticated by HMAC-SHA256 signature (not a user JWT), so
// config.toml sets verify_jwt = false. Idempotent: a duplicate PAYMENT_SUCCESS is a no-op.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-signature, x-webhook-timestamp",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Cashfree signs base64( HMAC-SHA256( timestamp + rawBody, secretKey ) ).
async function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string): Promise<boolean> {
  if (!secret || !signature || !timestamp) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.text();
    const signature = req.headers.get("x-webhook-signature") ?? "";
    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
    const secret = Deno.env.get("CASHFREE_SECRET_KEY") ?? "";

    const sigOk = await verifySignature(secret, timestamp, raw, signature);
    console.log("cashfree-webhook received:", { hasSig: !!signature, hasTs: !!timestamp, sigOk });
    if (!sigOk) {
      return reply({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(raw);
    const type: string = event?.type ?? "";
    console.log("cashfree-webhook type:", type);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (type === "PAYMENT_SUCCESS_WEBHOOK") {
      const orderId = event?.data?.order?.order_id ?? null;
      if (!orderId) return reply({ received: true });

      const { data: pay } = await admin.from("payments").select("*").eq("cashfree_order_id", orderId).maybeSingle();
      if (!pay || pay.status === "paid") return reply({ received: true }); // unknown or already handled

      await admin.from("payments")
        .update({ status: "paid", payload: event, updated_at: new Date().toISOString() })
        .eq("id", pay.id);

      await admin.from("slot_holds").delete().eq("payment_id", pay.id); // release the hold

      if (pay.kind === "session" && pay.payload?.booking) {
        const b = pay.payload.booking;
        const meetingId = crypto.randomUUID();
        const { data: sess } = await admin.from("sessions").insert({
          mentor_id: b.mentor_id,
          mentee_id: b.mentee_id,
          scheduled_at: b.scheduled_at,
          duration_minutes: b.duration_minutes,
          mentee_notes: b.notes ?? "",
          title: b.title ?? "Session",
          topic: b.topic ?? "",
          meeting_url: `https://meet.jit.si/mentorle-${meetingId}`,
          offering_id: b.offering_id ?? null,
        }).select("id").single();

        if (sess) {
          await admin.from("payments").update({ session_id: sess.id }).eq("id", pay.id);

          const { data: settings } = await admin.from("payment_settings").select("commission_percent").limit(1).maybeSingle();
          const commission = Number(settings?.commission_percent ?? 0);
          const gross = Number(pay.amount);
          const fee = Math.round(gross * commission) / 100;
          await admin.from("mentor_earnings").insert({
            mentor_id: b.mentor_id,
            source: "paid_session",
            reference_id: sess.id,
            gross_amount: gross,
            fee_amount: fee,
            net_amount: gross - fee,
          });
        }
      }
      return reply({ received: true });
    }

    if (type === "PAYMENT_FAILED_WEBHOOK" || type === "PAYMENT_USER_DROPPED_WEBHOOK") {
      const orderId = event?.data?.order?.order_id ?? null;
      if (orderId) {
        const { data: failedPay } = await admin.from("payments")
          .select("id").eq("cashfree_order_id", orderId).maybeSingle();
        await admin.from("payments")
          .update({ status: "failed", payload: event, updated_at: new Date().toISOString() })
          .eq("cashfree_order_id", orderId)
          .neq("status", "paid"); // never clobber an already-confirmed payment
        if (failedPay) await admin.from("slot_holds").delete().eq("payment_id", failedPay.id);
      }
      return reply({ received: true });
    }

    if (type.startsWith("SUBSCRIPTION")) {
      const d = (event?.data ?? {}) as Record<string, unknown>;
      const sub = ((d.subscription ?? d.subscription_details ?? d) ?? {}) as Record<string, unknown>;
      const subId = (sub.subscription_id ?? d.subscription_id ?? null) as string | null;
      const cfStatus = String(
        sub.subscription_status ?? d.subscription_status ?? sub.status ?? d.status ?? "",
      ).toUpperCase();
      console.log("cashfree-webhook SUBSCRIPTION parsed:", { type, subId, cfStatus });

      const map: Record<string, string> = {
        ACTIVE: "active",
        INITIALIZED: "pending",
        BANK_APPROVAL_PENDING: "pending",
        ON_HOLD: "past_due",
        CANCELLED: "cancelled",
        COMPLETED: "expired",
      };
      const newStatus = map[cfStatus];
      if (subId && newStatus) {
        // Don't downgrade a "cancel at period end" membership early — keep access until the
        // period ends (the expiry cron flips it to expired then).
        if (newStatus === "cancelled") {
          const { data: mem } = await admin
            .from("memberships")
            .select("cancel_at_period_end, current_period_end")
            .eq("cashfree_subscription_id", subId)
            .maybeSingle();
          if (mem?.cancel_at_period_end && mem.current_period_end && new Date(mem.current_period_end) > new Date()) {
            console.log("cashfree-webhook: cancel deferred to period end", subId);
            return reply({ received: true });
          }
        }
        const { error: upErr, count } = await admin
          .from("memberships")
          .update({ status: newStatus, updated_at: new Date().toISOString() }, { count: "exact" })
          .eq("cashfree_subscription_id", subId);
        console.log("cashfree-webhook membership update:", { subId, newStatus, count, upErr });
      }

      // Renewal: whenever Cashfree reports the next charge date (first cycle or any renewal
      // charge), advance the membership period so it stays active and "renews on" stays correct.
      const nextSchedule = (sub.next_schedule_date ?? d.next_schedule_date ?? null) as string | null;
      if (subId && nextSchedule) {
        const { error: rnErr, count: rnCount } = await admin
          .from("memberships")
          .update(
            {
              current_period_end: nextSchedule,
              current_period_start: new Date().toISOString(),
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { count: "exact" },
          )
          .eq("cashfree_subscription_id", subId)
          .in("status", ["active", "past_due", "pending"])
          .neq("cancel_at_period_end", true);
        console.log("cashfree-webhook renewal update:", { subId, nextSchedule, rnCount, rnErr });
      }
      return reply({ received: true });
    }

    return reply({ received: true });
  } catch (e) {
    return reply({ error: String(e) }, 500);
  }
});
