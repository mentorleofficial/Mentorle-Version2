// Admin user management — create (invite or temp password), disable, restore.
// Uses service-role internally so it never hijacks the admin's auth session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "disable" | "restore" | "delete";
type AppRole = "admin" | "mentor" | "mentee";
type Mode = "invite" | "password";

interface Payload {
  action: Action;
  // create
  email?: string;
  full_name?: string;
  role?: AppRole;
  mode?: Mode;
  password?: string;
  // disable / restore
  user_id?: string;
}

const json = (body: unknown, status = 200) => {
  if (body && typeof body === "object" && "error" in body) {
    console.error("admin-manage-user error:", body.error);
  }
  return new Response(JSON.stringify(body), {
    status: 200, // Always 200 to let client handle the error body directly
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const buildInviteHtml = (appName: string, recipientName: string, role: string, inviteUrl: string) => {
  const heading = `You've been invited to join ${escapeHtml(appName)}!`;
  const intro = `Hello ${escapeHtml(recipientName)},<br/><br/>You have been invited to join ${escapeHtml(appName)} as a <strong>${escapeHtml(role)}</strong>. Click the button below to accept the invitation and set up your password.`;

  const cta = `<tr><td align="center" style="padding:8px 24px 0;">
       <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Accept Invitation</a>
     </td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${heading}</title></head>
  <body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">${heading}</h1>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">${intro}</p>
          </td></tr>
          ${cta}
          <tr><td style="background:#f8fafc;padding:16px 24px;text-align:center;font-size:11px;color:#94a3b8;margin-top:24px;">
            Sent by ${escapeHtml(appName)}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
};

function getAppUrl(req: Request, branding?: any): string {
  // 1. Check database-configured site URL first
  if (branding?.site_url) {
    const dbUrl = branding.site_url.trim();
    if (dbUrl && !dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
      return dbUrl.startsWith("http") ? dbUrl : `https://${dbUrl}`;
    }
  }

  // 2. Check custom environment variable
  const envUrl = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || Deno.env.get("PUBLIC_APP_URL");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  // 3. Fallback to Origin or Referer header if not localhost or internal Supabase URL
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1") && !origin.includes("supabase.co") && !origin.includes("supabase.in")) {
    try {
      const parsed = new URL(origin);
      return parsed.origin;
    } catch (_) {
      // ignore
    }
  }

  // 4. Detect if running local supabase instance
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) {
    try {
      if (origin) return new URL(origin).origin;
    } catch (_) {
      // ignore
    }
    if (envUrl) return envUrl;
    return "http://localhost:5173";
  }

  // 5. Production fallback
  return "https://mentorle.vercel.app/";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized: Missing Authorization header" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized: " + (userErr?.message ?? "Invalid token") }, 401);
    const callerId = userData.user.id;

    // Service-role client (bypasses RLS for admin ops)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confirm admin role
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr) return json({ error: "Forbidden: check role RPC failed: " + roleErr.message }, 403);
    if (!isAdmin) return json({ error: "Forbidden: caller is not an admin" }, 403);

    const body = (await req.json().catch(() => ({}))) as Payload;
    const action = body.action;

    if (action === "create") {
      const email = (body.email ?? "").trim().toLowerCase();
      const full_name = (body.full_name ?? "").trim();
      const role = body.role;
      const mode: Mode = body.mode ?? "invite";
      if (!email || !full_name || !role) {
        return json({ error: "email, full_name and role are required" }, 400);
      }
      if (!["admin", "mentor", "mentee"].includes(role)) {
        return json({ error: "Invalid role" }, 400);
      }

      let userId: string | null = null;

      if (mode === "invite") {
        const { data: branding } = await admin
          .from("branding").select("*").limit(1).maybeSingle();
        const appUrl = getAppUrl(req, branding);
        const redirectUrl = appUrl.endsWith("/")
          ? `${appUrl}reset-password`
          : `${appUrl}/reset-password`;

        const { data: linkData, error: inviteErr } = await admin.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            data: { full_name, role },
            redirectTo: redirectUrl,
          },
        });
        if (inviteErr || !linkData?.properties?.action_link) {
          return json({ error: inviteErr?.message ?? "Failed to generate invitation link" }, 400);
        }
        userId = linkData.user?.id ?? null;
        const actionLink = linkData.properties.action_link;

        const BREVO = Deno.env.get("BREVO_API_KEY");
        if (!BREVO) {
          return json({ error: "BREVO_API_KEY not configured" }, 500);
        }

        const appName = branding?.app_name || "Mentorship Platform";
        const html = buildInviteHtml(appName, full_name, role, actionLink);
        const subject = `Invitation to join ${appName} as a ${role}`;

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": BREVO.trim(),
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { email: "noreply@mentorle.in", name: appName },
            to: [{ email, name: full_name }],
            subject,
            htmlContent: html,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          return json({ error: `Brevo error ${res.status}: ${text}` }, 502);
        }

        // If the invited user is a mentor, create a placeholder application in changes_requested status
        if (role === "mentor") {
          const { error: appErr } = await admin.from("mentor_applications").insert({
            full_name,
            email,
            bio: "",
            status: "changes_requested",
            changes_feedback: "Please complete your profile details to submit for review.",
          });
          if (appErr) {
            console.error("Failed to create placeholder mentor application:", appErr);
          }
        }
      } else {
        const password = body.password ?? "";
        if (password.length < 8) {
          return json({ error: "Password must be at least 8 characters" }, 400);
        }
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role },
        });
        if (error) return json({ error: error.message }, 400);
        userId = data.user?.id ?? null;

        // If the created user is a mentor, create a placeholder application in changes_requested status
        if (role === "mentor") {
          const { error: appErr } = await admin.from("mentor_applications").insert({
            full_name,
            email,
            bio: "",
            status: "changes_requested",
            changes_feedback: "Please complete your profile details to submit for review.",
          });
          if (appErr) {
            console.error("Failed to create placeholder mentor application:", appErr);
          }
        }
      }

      // The handle_new_user trigger inserts into public.users + user_roles using
      // the metadata above, so no extra writes required here.

      // Audit
      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "USER_CREATED",
        entity_type: "users",
        entity_id: userId ?? "",
        details: { email, full_name, role, mode },
      });

      return json({ ok: true, user_id: userId, mode });
    }

    if (action === "disable" || action === "restore") {
      const targetId = body.user_id;
      if (!targetId) return json({ error: "user_id is required" }, 400);
      if (targetId === callerId) return json({ error: "You cannot disable your own account" }, 400);

      const disabling = action === "disable";

      const { error: updErr } = await admin
        .from("users")
        .update({
          is_disabled: disabling,
          disabled_by: disabling ? callerId : null,
        })
        .eq("id", targetId);
      if (updErr) return json({ error: updErr.message }, 400);

      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: disabling ? "USER_DISABLED" : "USER_RESTORED",
        entity_type: "users",
        entity_id: targetId,
        details: {},
      });

      return json({ ok: true });
    }

    if (action === "delete") {
      const targetId = body.user_id;
      if (!targetId) return json({ error: "user_id is required" }, 400);
      if (targetId === callerId) return json({ error: "You cannot delete your own account" }, 400);

      const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
      if (delErr) return json({ error: delErr.message }, 400);

      await admin.from("audit_logs").insert({
        user_id: callerId,
        action: "USER_DELETED",
        entity_type: "users",
        entity_id: targetId,
        details: {},
      });

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});
