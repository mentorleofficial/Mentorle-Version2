// Emails for plan pass reminders (7 days before, 1 day before, after it ended). The notices themselves, and the bell
// notifications, are written by queue_membership_notices() (hourly pg_cron); this sends the emails for the notices
// that haven't been emailed yet. Called hourly by pg_cron with x-cron-secret, read from Supabase Vault
// (request_membership_reminder_emails() in migration 20261029120000).
// Each notice is emailed once; a failed send is retried on the next run, up to MAX_ATTEMPTS times.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SENDER_EMAIL = "noreply@mentorle.in";
const SENDER_NAME = "Mentorle";
const MAX_ATTEMPTS = 5;
const BATCH = 100;

type Notice = { id: string; user_id: string; kind: "ending_7d" | "ending_1d" | "ended"; period_end: string; plan_name: string; email_attempts: number };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const formatDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

function content(notice: Notice, name: string, freePlan: string) {
  const plan = notice.plan_name;
  const date = formatDate(notice.period_end);
  if (notice.kind === "ended")
    return {
      subject: `Your ${plan} has ended`,
      heading: `Your ${plan} has ended`,
      body: `Hi ${name}, your ${plan} ended on ${date}. You're on ${freePlan} now, so you can still browse mentors, events and the community. Renew any time to get your member benefits back.`,
      cta: `Renew ${plan}`,
    };
  return {
    subject: notice.kind === "ending_1d" ? `Your ${plan} ends tomorrow` : `Your ${plan} ends in 7 days`,
    heading: notice.kind === "ending_1d" ? `Your ${plan} ends tomorrow` : `Your ${plan} ends in 7 days`,
    body: `Hi ${name}, your ${plan} ends on ${date}. It doesn't renew on its own: renew before then to keep your member benefits, and the new year is added on top of the time you have left.`,
    cta: `Renew ${plan}`,
  };
}

const emailHtml = (c: { heading: string; body: string; cta: string }, url: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">${escapeHtml(c.heading)}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">${escapeHtml(c.body)}</p>
        </td></tr>
        <tr><td align="center" style="padding:0 24px 28px;">
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(c.cta)}</a>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;">
          Sent by Mentorle because you have a Mentorle plan. If you didn't expect this email, you can safely ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

async function sendBrevo(apiKey: string, to: { email: string; name: string }, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
    body: JSON.stringify({ sender: { email: SENDER_EMAIL, name: SENDER_NAME }, to: [to], subject, htmlContent: html }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  // Deployed with verify_jwt=false so pg_cron can call it; the shared secret keeps it private. Fails closed.
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  const BREVO = Deno.env.get("BREVO_API_KEY")?.trim();
  if (!BREVO) return json({ error: "BREVO_API_KEY not configured" }, 500);

  const site = (Deno.env.get("MENTEE_SITE_URL") ?? "https://mentorle.in").replace(/\/$/, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Only recent notices: an email about a pass that ended weeks ago would just confuse.
  const { data: notices, error } = await admin
    .from("membership_notices")
    .select("id, user_id, kind, period_end, plan_name, email_attempts")
    .is("emailed_at", null)
    .lt("email_attempts", MAX_ATTEMPTS)
    .gt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .order("created_at")
    .limit(BATCH);
  if (error) return json({ error: error.message }, 500);
  if (!notices?.length) return json({ sent: 0, failed: 0 });

  const ids = [...new Set(notices.map((n) => n.user_id))];
  const [{ data: users }, { data: free }] = await Promise.all([
    admin.from("users").select("id, email, full_name").in("id", ids),
    admin.from("subscription_plans").select("name").eq("is_active", true).eq("billing", "free").order("sort_order").limit(1),
  ]);
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  const freePlan = free?.[0]?.name ?? "the free plan";

  let sent = 0;
  let failed = 0;
  for (const notice of notices as Notice[]) {
    const user = byId.get(notice.user_id);
    if (!user?.email) {
      await admin.from("membership_notices").update({ email_attempts: MAX_ATTEMPTS }).eq("id", notice.id);
      continue;
    }
    const name = (user.full_name ?? "").trim().split(/\s+/)[0] || "there";
    const c = content(notice, name, freePlan);
    try {
      await sendBrevo(BREVO, { email: user.email, name: user.full_name || user.email }, c.subject, emailHtml(c, `${site}/pricing`));
      await admin.from("membership_notices").update({ emailed_at: new Date().toISOString(), email_attempts: notice.email_attempts + 1 }).eq("id", notice.id);
      sent++;
    } catch (e) {
      console.error(`membership reminder ${notice.id} failed`, e);
      await admin.from("membership_notices").update({ email_attempts: notice.email_attempts + 1 }).eq("id", notice.id);
      failed++;
    }
  }
  return json({ sent, failed });
});
