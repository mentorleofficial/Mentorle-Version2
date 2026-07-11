// Sends a "Thank you for applying" email to a mentor applicant via Brevo.
// Called client-side (fire-and-forget) after a successful application insert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const buildHtml = (appName: string, recipientName: string) => {
  const safe = (s: string) => escapeHtml(s);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Thank You for Applying</title></head>
  <body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Thank You for Applying</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">Dear ${safe(recipientName)},</p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
              Thank you for applying to become a mentor with ${safe(appName)}.
            </p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
              We are glad to see your interest in sharing your knowledge, experience, and guidance with learners who are preparing for their academic and career journeys.
            </p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
              To proceed with your application, please complete your mentor profile immediately by adding all required details such as your experience, expertise areas, current or previous work background, education, LinkedIn profile, and any relevant portfolio or resume.
            </p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;">
              A complete profile will help our team review your application accurately and match you with the right mentoring opportunities.
            </p>
          </td></tr>
          <tr><td style="padding:0 24px 8px;">
            <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;font-size:14px;color:#334155;">
              <strong style="color:#0f172a;display:block;margin-bottom:6px;">What happens next?</strong>
              Our team will evaluate your application based on your profile, expertise, experience, and mentoring interests. If your profile is shortlisted, we will get in touch with you for the next step.
            </div>
          </td></tr>
          <tr><td style="padding:8px 24px 24px;">
            <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#475569;">
              Thank you once again for your willingness to contribute to learner growth.
            </p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
              Warm regards,<br/>
              <strong>Team ${safe(appName)}</strong>
            </p>
          </td></tr>
          <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;">
            Sent by ${safe(appName)}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
};

function getAppUrl(req: Request, branding?: any): string {
  if (branding?.site_url) {
    const dbUrl = branding.site_url.trim();
    if (dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
      return dbUrl.startsWith("http") ? dbUrl : `https://${dbUrl}`;
    }
  }
  const envUrl = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_APP_URL");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1") && !origin.includes("supabase.co")) {
    try { return new URL(origin).origin; } catch (_) { /* ignore */ }
  }
  return "https://mentorle.vercel.app/";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const BREVO = Deno.env.get("BREVO_API_KEY");
    if (!BREVO) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is a logged-in user (not necessarily admin)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const full_name: string = String(body?.full_name ?? "").trim();
    const email: string = String(body?.email ?? "").trim();

    if (!full_name || !email) {
      return new Response(JSON.stringify({ error: "full_name and email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: branding } = await admin.from("branding").select("*").limit(1).maybeSingle();
    const appName = branding?.app_name || "Mentorship Platform";

    const html = buildHtml(appName, full_name);
    const subject = `Thank You for Applying to Become a Mentor with ${appName}`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO.trim(), accept: "application/json" },
      body: JSON.stringify({
        sender: { email: "noreply@mentorle.in", name: appName },
        to: [{ email, name: full_name }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Brevo ${res.status}: ${text}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
