// The buyer's "is my payment through?" check, used by the page Cashfree returns to. Reads the order from
// Cashfree and settles it the same way the webhook does, so a slow or missing webhook (or local development,
// where Cashfree can't reach the webhook) still delivers the session, registration or pass. Idempotent.
import { cashfree, corsHeaders, json, outcomeOf, paymentByOrder, serviceClient, settleFailed, settlePaid } from "../_shared/payments.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const { order_id: orderId } = (await req.json().catch(() => ({}))) as { order_id?: string };
    if (!orderId) return json({ error: "order_id is required" }, 400);
    const admin = serviceClient();
    const payment = await paymentByOrder(admin, orderId);
    if (!payment || payment.user_id !== userData.user.id) return json({ error: "Order not found" }, 404);

    if (payment.status === "paid") return json(await settlePaid(admin, payment, payment.payload?.cashfree ?? null));
    if (payment.status === "failed" || payment.status === "refunded") return json(outcomeOf(payment));

    const order = await cashfree(`/orders/${encodeURIComponent(orderId)}`);
    if (!order.ok) return json(outcomeOf(payment));
    const status = String(order.data.order_status ?? "");
    if (status === "PAID") return json(await settlePaid(admin, payment, { source: "verify", order: order.data }));
    if (status === "EXPIRED" || status === "TERMINATED") {
      await settleFailed(admin, payment, { source: "verify", order: order.data });
      return json({ ...outcomeOf(payment), status: "failed" });
    }
    // A failed attempt leaves the order ACTIVE (Cashfree allows retries on its page). The buyer is back on our
    // status page, so when every attempt failed or was dropped, close the order (no late charge) and report it.
    const attempts = await cashfree(`/orders/${encodeURIComponent(orderId)}/payments`);
    const list = attempts.ok && Array.isArray(attempts.data) ? (attempts.data as { payment_status?: string }[]) : [];
    if (list.length && list.every((p) => ["FAILED", "USER_DROPPED", "CANCELLED"].includes(String(p.payment_status)))) {
      const closed = await cashfree(`/orders/${encodeURIComponent(orderId)}`, { method: "PATCH", body: { order_status: "TERMINATED" } });
      if (closed.ok) {
        await settleFailed(admin, payment, { source: "verify", order: closed.data, payments: list });
        return json({ ...outcomeOf(payment), status: "failed" });
      }
    }
    return json({ ...outcomeOf(payment), status: "pending" });
  } catch (e) {
    console.error("cashfree-verify-order", e);
    return json({ error: "Couldn't check the payment" }, 500);
  }
});
