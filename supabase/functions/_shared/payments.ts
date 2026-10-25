// Shared by cashfree-create-order, cashfree-verify-order and cashfree-webhook: Cashfree API access and the one
// way a successful payment is turned into what was bought. The database functions do the work and are
// idempotent, so a webhook and a verify call racing each other (or a retried webhook) is safe.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const isProduction = () => (Deno.env.get("CASHFREE_ENV") ?? "sandbox") === "production";
export const cashfreeMode = () => (isProduction() ? "production" : "sandbox");
const cashfreeBase = () => (isProduction() ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

export function cashfreeKeys() {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  return appId && secret ? { appId, secret } : null;
}

export async function cashfree(path: string, init: { method?: string; body?: unknown } = {}) {
  const keys = cashfreeKeys();
  if (!keys) throw new Error("Cashfree is not configured");
  const res = await fetch(`${cashfreeBase()}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", "x-api-version": "2023-08-01", "x-client-id": keys.appId, "x-client-secret": keys.secret },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

export const serviceClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

export type Payment = {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  amount: number;
  reference_id: string | null;
  session_id: string | null;
  cashfree_order_id: string | null;
  payload: Record<string, unknown> | null;
};

export type Outcome = {
  status: string;
  kind: string;
  amount: number;
  session_id?: string | null;
  registration_id?: string | null;
  membership_id?: string | null;
  needs_refund?: boolean;
};

const PAYMENT_COLUMNS = "id, user_id, kind, status, amount, reference_id, session_id, cashfree_order_id, payload";

export async function paymentByOrder(admin: SupabaseClient, orderId: string) {
  const { data } = await admin.from("payments").select(PAYMENT_COLUMNS).eq("cashfree_order_id", orderId).maybeSingle();
  return data as Payment | null;
}

// Delivers what was paid for (session, event registration, pass). Safe to call again.
async function fulfil(admin: SupabaseClient, payment: Payment): Promise<Outcome> {
  const base: Outcome = { status: "paid", kind: payment.kind, amount: Number(payment.amount) };
  if (payment.kind === "session") {
    const { data, error } = await admin.rpc("complete_paid_session", { _payment_id: payment.id });
    if (error) throw new Error(`complete_paid_session: ${error.message}`);
    const sessionId = (data as string | null) ?? null;
    if (sessionId) await sendBookingEmail(sessionId);
    return { ...base, session_id: sessionId, needs_refund: !sessionId };
  }
  if (payment.kind === "event") {
    const { data, error } = await admin.rpc("complete_paid_event", { _payment_id: payment.id });
    if (error) throw new Error(`complete_paid_event: ${error.message}`);
    return { ...base, registration_id: data as string };
  }
  if (payment.kind === "membership") {
    const { data, error } = await admin.rpc("activate_membership", { _payment_id: payment.id });
    if (error) throw new Error(`activate_membership: ${error.message}`);
    return { ...base, membership_id: data as string };
  }
  return base;
}

// Marks the order paid (keeping what was stored with it) and delivers it.
export async function settlePaid(admin: SupabaseClient, payment: Payment, gatewayEvent: unknown): Promise<Outcome> {
  if (payment.status !== "paid") {
    const { data } = await admin
      .from("payments")
      .update({ status: "paid", payload: { ...(payment.payload ?? {}), cashfree: gatewayEvent }, updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .neq("status", "paid")
      .select(PAYMENT_COLUMNS)
      .maybeSingle();
    payment = (data as Payment | null) ?? (await paymentByOrder(admin, payment.cashfree_order_id!))!;
  }
  return fulfil(admin, payment);
}

export async function settleFailed(admin: SupabaseClient, payment: Payment, gatewayEvent: unknown) {
  await admin
    .from("payments")
    .update({ status: "failed", payload: { ...(payment.payload ?? {}), cashfree: gatewayEvent }, updated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .neq("status", "paid"); // never undo a confirmed payment
  await admin.from("slot_holds").delete().eq("payment_id", payment.id);
}

// The booking confirmation emails, sent as the system (send-booking-email accepts the service role).
async function sendBookingEmail(sessionId: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-booking-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ sessionId }),
    });
  } catch (error) {
    console.error("booking email failed", error);
  }
}

// What the payment delivered so far, for the status page.
export function outcomeOf(payment: Payment): Outcome {
  const payload = payment.payload ?? {};
  return {
    status: payment.status,
    kind: payment.kind,
    amount: Number(payment.amount),
    session_id: payment.session_id,
    registration_id: (payload.registration_id as string | undefined) ?? null,
    membership_id: (payload.membership_id as string | undefined) ?? null,
    needs_refund: Boolean(payload.needs_refund),
  };
}
