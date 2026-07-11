import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENDER_EMAIL = "noreply@mentorle.in";
const SENDER_NAME = "Mentorle";

interface Recipient {
  email: string;
  name?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${formatted} IST`;
};

const buildEmailHtml = (opts: {
  role: "mentor" | "mentee";
  recipientName: string;
  otherPartyName: string;
  sessionTitle: string;
  whenLabel: string;
  meetingUrl: string;
  durationMinutes: number;
}) => {
  const { role, recipientName, otherPartyName, sessionTitle, whenLabel, meetingUrl, durationMinutes } = opts;
  const heading = `Reminder: Session starting in 30 minutes`;
  const intro =
    role === "mentee"
      ? `Hi ${escapeHtml(recipientName)}, this is a reminder that your mentorship session with ${escapeHtml(otherPartyName)} starts in 30 minutes.`
      : `Hi ${escapeHtml(recipientName)}, this is a reminder that you have a mentorship session with ${escapeHtml(otherPartyName)} starting in 30 minutes.`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">${heading}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">${intro}</p>
        </td></tr>
        <tr><td style="padding:0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;">
            <tr><td style="padding:16px 20px;font-size:14px;color:#0f172a;">
              <div style="margin-bottom:8px;"><strong>Title:</strong> ${escapeHtml(sessionTitle || "Mentorship Session")}</div>
              <div style="margin-bottom:8px;"><strong>When:</strong> ${escapeHtml(whenLabel)}</div>
              <div style="margin-bottom:8px;"><strong>Duration:</strong> ${durationMinutes} minutes</div>
              <div><strong>${role === "mentee" ? "Mentor" : "Mentee"}:</strong> ${escapeHtml(otherPartyName)}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td align="center" style="padding:0 24px;">
          <a href="${escapeHtml(meetingUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Join meeting now</a>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;word-break:break-all;">
            Meeting link: <a href="${escapeHtml(meetingUrl)}" style="color:#64748b;">${escapeHtml(meetingUrl)}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;">
          Sent by Mentorle. If you didn't expect this email, you can safely ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

const sendBrevo = async (apiKey: string, args: {
  to: Recipient;
  subject: string;
  html: string;
}) => {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: args.to.email, name: args.to.name || args.to.email }],
      subject: args.subject,
      htmlContent: args.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
  return res.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BREVO = Deno.env.get("BREVO_API_KEY");

    if (!BREVO) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Query sessions starting in 30 minutes (window of 25 to 35 minutes from now)
    // that have not yet had a reminder sent.
    const now = new Date();
    const minTime = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
    const maxTime = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

    const { data: sessions, error: fetchErr } = await admin
      .from("sessions")
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        meeting_url,
        mentor:users!sessions_mentor_id_fkey(email, full_name),
        mentee:users!sessions_mentee_id_fkey(email, full_name)
      `)
      .eq("status", "booked")
      .is("reminder_sent_at", null)
      .gte("scheduled_at", minTime)
      .lte("scheduled_at", maxTime);

    if (fetchErr) throw fetchErr;

    const count = sessions?.length || 0;
    console.log(`Found ${count} sessions requiring reminders.`);

    if (count === 0) {
      return new Response(JSON.stringify({ success: true, message: "No reminders due" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: any[] = [];
    for (const session of sessions || []) {
      const { id, title, scheduled_at, duration_minutes, meeting_url, mentor, mentee } = session;
      const whenLabel = formatDateTime(scheduled_at);

      if (!mentor || !mentee) {
        console.warn(`Session ${id} missing mentor or mentee relation.`);
        continue;
      }

      const menteeHtml = buildEmailHtml({
        role: "mentee",
        recipientName: mentee.full_name,
        otherPartyName: mentor.full_name,
        sessionTitle: title,
        whenLabel,
        meetingUrl: meeting_url,
        durationMinutes: duration_minutes,
      });

      const mentorHtml = buildEmailHtml({
        role: "mentor",
        recipientName: mentor.full_name,
        otherPartyName: mentee.full_name,
        sessionTitle: title,
        whenLabel,
        meetingUrl: meeting_url,
        durationMinutes: duration_minutes,
      });

      // Send emails
      const emailResults = await Promise.allSettled([
        sendBrevo(BREVO.trim(), {
          to: { email: mentee.email, name: mentee.full_name },
          subject: `Reminder: Session starting in 30 minutes — ${whenLabel}`,
          html: menteeHtml,
        }),
        sendBrevo(BREVO.trim(), {
          to: { email: mentor.email, name: mentor.full_name },
          subject: `Reminder: Session starting in 30 minutes — ${whenLabel}`,
          html: mentorHtml,
        }),
      ]);

      const failed = emailResults.some((r) => r.status === "rejected");
      if (failed) {
        console.error(`Failed to send email reminders for session ${id}`, emailResults);
        errors.push({ session_id: id, details: emailResults });
      }

      // Mark reminder as sent regardless of individual Brevo delivery errors to prevent infinite spam loops
      const { error: updateErr } = await admin
        .from("sessions")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", id);

      if (updateErr) {
        console.error(`Failed to update reminder_sent_at for session ${id}`, updateErr);
      }
    }

    return new Response(JSON.stringify({ success: errors.length === 0, count, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-session-reminders error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
