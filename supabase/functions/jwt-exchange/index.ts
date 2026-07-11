// Public endpoint: validates an external JWT and returns a Supabase session
// for the mapped user (auto-provisioning if enabled).
//
// The external JWT IS the auth — no caller auth header required.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jwtVerify, importSPKI, createRemoteJWKSet } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function logAudit(
  admin: ReturnType<typeof createClient>,
  userId: string | null,
  action: string,
  details: Record<string, unknown>,
) {
  try {
    await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      entity_type: "jwt_exchange",
      details,
    });
  } catch {
    /* swallow — logging must never break auth */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return json({ error: "Missing token" }, 400);

    // Load JWT config
    const { data: cfg, error: cfgErr } = await admin
      .from("jwt_config")
      .select("*")
      .limit(1)
      .single();
    if (cfgErr || !cfg) return json({ error: "No JWT config saved" }, 400);
    if (!cfg.enabled) return json({ error: "JWT login is disabled" }, 403);

    // Verify signature + standard claims
    const opts: any = {
      algorithms: [cfg.algorithm || "RS256"],
      clockTolerance: cfg.allowed_clock_skew_seconds ?? 30,
    };
    if (cfg.issuer) opts.issuer = cfg.issuer;
    if (cfg.audience) opts.audience = cfg.audience;

    let payload: any;
    try {
      if (cfg.jwks_url) {
        const JWKS = createRemoteJWKSet(new URL(cfg.jwks_url));
        const verified = await jwtVerify(token, JWKS, opts);
        payload = verified.payload;
      } else if (cfg.public_key) {
        const key = await importSPKI(cfg.public_key, cfg.algorithm || "RS256");
        const verified = await jwtVerify(token, key, opts);
        payload = verified.payload;
      } else {
        await logAudit(admin, null, "jwt_login_failure", { reason: "no_key" });
        return json({ error: "Server misconfigured: no JWKS URL or public key" }, 500);
      }
    } catch (e: any) {
      await logAudit(admin, null, "jwt_login_failure", { reason: "verify_failed", message: e?.message });
      return json({ error: e?.message || "Token verification failed" }, 401);
    }

    // Map claims
    const email = String(payload[cfg.claim_email || "email"] ?? "").toLowerCase().trim();
    const fullName = String(payload[cfg.claim_full_name || "name"] ?? "").trim();
    const externalId = String(payload[cfg.claim_user_id || "sub"] ?? "").trim();
    const claimedRole = payload[cfg.claim_role || "role"];
    const role = (["admin", "mentor", "mentee"].includes(claimedRole) ? claimedRole : (cfg.default_role || "mentee")) as
      | "admin"
      | "mentor"
      | "mentee";

    if (!email && !externalId) {
      await logAudit(admin, null, "jwt_login_failure", { reason: "missing_identity" });
      return json({ error: "Token missing email and user id claims" }, 400);
    }

    // Look up existing user — by external_id first, then email
    let userId: string | null = null;

    if (externalId) {
      const { data: byExt } = await admin
        .from("users")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();
      if (byExt?.id) userId = byExt.id;
    }

    if (!userId && email) {
      const { data: byEmail } = await admin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (byEmail?.id) {
        userId = byEmail.id;
        // Backfill external_id if we now know it
        if (externalId) {
          await admin.from("users").update({ external_id: externalId }).eq("id", userId);
        }
      }
    }

    // Auto-provision if needed
    if (!userId) {
      if (!cfg.auto_provision) {
        await logAudit(admin, null, "jwt_login_failure", { reason: "user_not_found", email, externalId });
        return json({ error: "No matching user and auto-provisioning is disabled" }, 403);
      }
      if (!email) {
        return json({ error: "Cannot provision user without email claim" }, 400);
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName || email.split("@")[0], role },
      });
      if (createErr || !created.user) {
        await logAudit(admin, null, "jwt_login_failure", { reason: "create_user_failed", message: createErr?.message });
        return json({ error: createErr?.message || "Failed to create user" }, 500);
      }
      userId = created.user.id;

      // Ensure public.users row matches mapped role + external_id
      // (handle_new_user trigger creates a default row; we update it here)
      await admin
        .from("users")
        .update({
          full_name: fullName || email.split("@")[0],
          role,
          external_id: externalId || null,
        })
        .eq("id", userId);

      // Make sure user_roles has the right role too
      await admin.from("user_roles").upsert(
        { user_id: userId, role },
        { onConflict: "user_id,role" },
      );
    }

    // Issue a Supabase session via magic link generation
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email || (await admin.auth.admin.getUserById(userId!)).data.user?.email || "",
    });
    if (linkErr || !linkData) {
      await logAudit(admin, userId, "jwt_login_failure", { reason: "link_generate_failed", message: linkErr?.message });
      return json({ error: linkErr?.message || "Failed to generate session" }, 500);
    }

    // The action_link contains tokens in the URL hash. Verify the OTP to get session tokens.
    const hashedToken = (linkData.properties as any)?.hashed_token;
    if (!hashedToken) {
      await logAudit(admin, userId, "jwt_login_failure", { reason: "no_hashed_token" });
      return json({ error: "Failed to generate session token" }, 500);
    }

    const { data: verifyData, error: verifyErr } = await admin.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashedToken,
    });
    if (verifyErr || !verifyData.session) {
      await logAudit(admin, userId, "jwt_login_failure", { reason: "verify_otp_failed", message: verifyErr?.message });
      return json({ error: verifyErr?.message || "Failed to mint session" }, 500);
    }

    await logAudit(admin, userId, "jwt_login_success", { email, externalId, role });

    return json({
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
      expires_at: verifyData.session.expires_at,
      user_id: userId,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});
