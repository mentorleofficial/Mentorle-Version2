// Send booking confirmation emails via Brevo (transactional email API).
// Triggered from BookSession.tsx after a successful booking.

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

interface Payload {
  mentorEmail: string;
  mentorName: string;
  menteeEmail: string;
  menteeName: string;
  scheduledAtISO: string;
  durationMinutes: number;
  meetingUrl: string;
  menteeNotes?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const toCalDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
};

const buildGoogleCalendarUrl = (p: {
  title: string;
  details: string;
  location: string;
  startISO: string;
  durationMinutes: number;
}) => {
  const end = new Date(new Date(p.startISO).getTime() + p.durationMinutes * 60_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: p.title,
    dates: `${toCalDate(p.startISO)}/${toCalDate(end)}`,
    details: p.details,
    location: p.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// All emails show times in IST (Asia/Kolkata) regardless of recipient locale.
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
  audience: "mentor" | "mentee";
  recipientName: string;
  otherPartyName: string;
  whenLabel: string;
  durationMinutes: number;
  meetingUrl: string;
  calendarUrl: string;
  menteeNotes?: string;
}) => {
  const { audience, recipientName, otherPartyName, whenLabel, durationMinutes, meetingUrl, calendarUrl, menteeNotes } = opts;
  const heading =
    audience === "mentee"
      ? `Your session with ${escapeHtml(otherPartyName)} is confirmed`
      : `New session booked with ${escapeHtml(otherPartyName)}`;

  const intro =
    audience === "mentee"
      ? `Hi ${escapeHtml(recipientName)}, your mentorship session is booked. Details below — add it to your calendar so you don't forget!`
      : `Hi ${escapeHtml(recipientName)}, ${escapeHtml(otherPartyName)} just booked a mentorship session with you. Details below.`;

  const notesBlock =
    audience === "mentor" && menteeNotes
      ? `<tr><td style="padding:16px 24px 0;"><div style="background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px;color:#334155;">
           <strong style="color:#0f172a;">What they'd like to discuss:</strong><br/>
           ${escapeHtml(menteeNotes)}
         </div></td></tr>`
      : "";

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
              <div style="margin-bottom:8px;"><strong>When:</strong> ${escapeHtml(whenLabel)}</div>
              <div style="margin-bottom:8px;"><strong>Duration:</strong> ${durationMinutes} minutes</div>
              <div><strong>${audience === "mentee" ? "Mentor" : "Mentee"}:</strong> ${escapeHtml(otherPartyName)}</div>
            </td></tr>
          </table>
        </td></tr>
        ${notesBlock}
        <tr><td style="height:20px;"></td></tr>
        <tr><td align="center" style="padding:0 24px;">
          <a href="${escapeHtml(meetingUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Join meeting</a>
        </td></tr>
        <tr><td align="center" style="padding:12px 24px 0;">
          <a href="${escapeHtml(calendarUrl)}" style="display:inline-block;color:#0f172a;text-decoration:underline;font-size:13px;">Add to Google Calendar</a>
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
    const rawKey = Deno.env.get("BREVO_API_KEY");
    if (!rawKey) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = rawKey.trim();
    console.log("BREVO_API_KEY debug:", {
      length: apiKey.length,
      prefix: apiKey.slice(0, 9),
      startsWithXkeysib: apiKey.startsWith("xkeysib-"),
    });

    const body = (await req.json()) as Payload;
    const required: (keyof Payload)[] = ["mentorEmail", "mentorName", "menteeEmail", "menteeName", "scheduledAtISO", "durationMinutes", "meetingUrl"];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === "") {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const whenLabel = formatDateTime(body.scheduledAtISO);

    const menteeCalendarUrl = buildGoogleCalendarUrl({
      title: `Mentorship session with ${body.mentorName}`,
      details: `Meeting link: ${body.meetingUrl}`,
      location: body.meetingUrl,
      startISO: body.scheduledAtISO,
      durationMinutes: body.durationMinutes,
    });

    const mentorCalendarUrl = buildGoogleCalendarUrl({
      title: `Mentorship session with ${body.menteeName}`,
      details: [
        `Meeting link: ${body.meetingUrl}`,
        body.menteeNotes ? `Mentee asked: ${body.menteeNotes}` : "",
      ].filter(Boolean).join("\n"),
      location: body.meetingUrl,
      startISO: body.scheduledAtISO,
      durationMinutes: body.durationMinutes,
    });

    const menteeHtml = buildEmailHtml({
      audience: "mentee",
      recipientName: body.menteeName,
      otherPartyName: body.mentorName,
      whenLabel,
      durationMinutes: body.durationMinutes,
      meetingUrl: body.meetingUrl,
      calendarUrl: menteeCalendarUrl,
    });

    const mentorHtml = buildEmailHtml({
      audience: "mentor",
      recipientName: body.mentorName,
      otherPartyName: body.menteeName,
      whenLabel,
      durationMinutes: body.durationMinutes,
      meetingUrl: body.meetingUrl,
      calendarUrl: mentorCalendarUrl,
      menteeNotes: body.menteeNotes,
    });

    const results = await Promise.allSettled([
      sendBrevo(apiKey, {
        to: { email: body.menteeEmail, name: body.menteeName },
        subject: `Session confirmed with ${body.mentorName} — ${whenLabel}`,
        html: menteeHtml,
      }),
      sendBrevo(apiKey, {
        to: { email: body.mentorEmail, name: body.mentorName },
        subject: `New session booked: ${body.menteeName} — ${whenLabel}`,
        html: mentorHtml,
      }),
    ]);

    const errors = results.flatMap((r, i) =>
      r.status === "rejected" ? [{ to: i === 0 ? "mentee" : "mentor", error: String(r.reason) }] : []
    );
    if (errors.length) console.error("Brevo send errors:", errors);

    return new Response(JSON.stringify({ ok: errors.length === 0, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-booking-email error:", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
