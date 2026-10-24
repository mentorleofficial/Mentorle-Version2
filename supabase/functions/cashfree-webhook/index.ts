// Cashfree -> us. Marks payments paid or failed and delivers what was bought (through the shared settle code,
// which cashfree-verify-order uses too), and keeps legacy Plus subscriptions in step. Authenticated by
// HMAC-SHA256 signature (not a user JWT), so config.toml sets verify_jwt = false. Idempotent.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { paymentByOrder, settleFailed, settlePaid } from "../_shared/payments.ts";

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

    if (type === "PAYMENT_SUCCESS_WEBHOOK" || type === "PAYMENT_FAILED_WEBHOOK" || type === "PAYMENT_USER_DROPPED_WEBHOOK") {
      const orderId = event?.data?.order?.order_id ?? null;
      const payment = orderId ? await paymentByOrder(admin, orderId) : null;
      if (!payment) return reply({ received: true }); // not one of ours
      if (type === "PAYMENT_SUCCESS_WEBHOOK") await settlePaid(admin, payment, event);
      else await settleFailed(admin, payment, event);
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
