import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENDER_EMAIL = "noreply@mentorle.in";

interface Recipient {
  email: string;
  name?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const getSiteUrl = (branding: any): string => {
  if (branding?.site_url) {
    const url = branding.site_url.trim();
    if (url) return url.startsWith("http") ? url : `https://${url}`;
  }
  return "https://mentorle.vercel.app/";
};

const buildEmailHtml = (opts: {
  appName: string;
  recipientName: string;
  otherPartyName: string;
  sessionTitle: string;
  feedbackUrl: string;
  role: "mentor" | "mentee";
}) => {
  const { appName, recipientName, otherPartyName, sessionTitle, feedbackUrl, role } = opts;
  const heading = role === "mentee" 
    ? `How was your session with ${escapeHtml(otherPartyName)}?`
    : `How did your session with ${escapeHtml(otherPartyName)} go?`;
  
  const intro = role === "mentee"
    ? `Hi ${escapeHtml(recipientName)}, we hope you had a great mentorship session on "${escapeHtml(sessionTitle || "your topic")}" with ${escapeHtml(otherPartyName)}.`
    : `Hi ${escapeHtml(recipientName)}, we hope your mentorship session on "${escapeHtml(sessionTitle || "your topic")}" with ${escapeHtml(otherPartyName)} went well.`;

  const body = role === "mentee"
    ? `Please take 60 seconds to rate your experience. Your feedback helps your mentor grow and helps other mentees find outstanding guidance.`
    : `Please take 60 seconds to rate your experience and share notes on the mentee's engagement. Your rating is private to admins, but stars and public logs help us track progress.`;

  const btnLabel = role === "mentee" ? "Share your feedback" : "Rate your mentee";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">${heading}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">${intro}</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">${body}</p>
        </td></tr>
        <tr><td align="center" style="padding:0 24px;">
          <a href="${escapeHtml(feedbackUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${btnLabel}</a>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;word-break:break-all;">
            Rating link: <a href="${escapeHtml(feedbackUrl)}" style="color:#64748b;">${escapeHtml(feedbackUrl)}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;">
          Sent by ${escapeHtml(appName)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

const sendBrevo = async (apiKey: string, senderName: string, args: {
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
      sender: { email: SENDER_EMAIL, name: senderName },
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

    const body = await req.json();
    const { session_id } = body;
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Fetch session and user details
    const { data: session, error: fetchErr } = await admin
      .from("sessions")
      .select(`
        id,
        title,
        status,
        mentor:users!sessions_mentor_id_fkey(email, full_name),
        mentee:users!sessions_mentee_id_fkey(email, full_name)
      `)
      .eq("id", session_id)
      .single();

    if (fetchErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch platform branding details
    const { data: branding } = await admin
      .from("branding")
      .select("*")
      .limit(1)
      .maybeSingle();

    const appName = branding?.app_name || "Mentorle";
    const siteUrl = getSiteUrl(branding);

    const { mentee, mentor } = session;
    if (!mentee || !mentor) {
      return new Response(JSON.stringify({ error: "Mentee or Mentor details not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build URL pointing to: https://<site-url>/session/<id>/feedback
    const feedbackUrl = `${siteUrl.replace(/\/$/, "")}/session/${session_id}/feedback`;

    const menteeHtml = buildEmailHtml({
      appName,
      recipientName: mentee.full_name,
      otherPartyName: mentor.full_name,
      sessionTitle: session.title,
      feedbackUrl,
      role: "mentee",
    });

    const mentorHtml = buildEmailHtml({
      appName,
      recipientName: mentor.full_name,
      otherPartyName: mentee.full_name,
      sessionTitle: session.title,
      feedbackUrl,
      role: "mentor",
    });

    // Send emails via Brevo to both mentee and mentor
    const results = await Promise.allSettled([
      sendBrevo(BREVO.trim(), appName, {
        to: { email: mentee.email, name: mentee.full_name },
        subject: `How was your session with ${mentor.full_name}?`,
        html: menteeHtml,
      }),
      sendBrevo(BREVO.trim(), appName, {
        to: { email: mentor.email, name: mentor.full_name },
        subject: `How did your session with ${mentee.full_name} go?`,
        html: mentorHtml,
      }),
    ]);

    const errors = results.flatMap((r, i) =>
      r.status === "rejected" ? [{ to: i === 0 ? "mentee" : "mentor", error: String(r.reason) }] : []
    );
    if (errors.length) console.error("Brevo feedback request send errors:", errors);

    return new Response(JSON.stringify({ success: errors.length === 0, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-feedback-request error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
