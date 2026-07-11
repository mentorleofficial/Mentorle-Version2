// Validate a sample JWT against the saved jwt_config (admin-only).
// Pure validation: returns header, payload, mapped user fields, and any errors.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jwtVerify, importSPKI, importJWK, createRemoteJWKSet } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeBase64Url(input: string): string {
  const pad = input.length % 4;
  const padded = input + "=".repeat(pad ? 4 - pad : 0);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

function decodeJwtParts(token: string): { header: any; payload: any } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return {
      header: JSON.parse(decodeBase64Url(parts[0])),
      payload: JSON.parse(decodeBase64Url(parts[1])),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, errors: ["Unauthorized"] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ ok: false, errors: ["Unauthorized"] }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin check
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, errors: ["Admin only"] }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      return new Response(JSON.stringify({ ok: false, errors: ["Missing token"] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load config
    const { data: cfg } = await admin.from("jwt_config").select("*").limit(1).single();
    if (!cfg) {
      return new Response(JSON.stringify({ ok: false, errors: ["No JWT config saved"] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const decoded = decodeJwtParts(token);
    const errors: string[] = [];

    let payload: any = decoded?.payload ?? null;
    let header: any = decoded?.header ?? null;

    try {
      const opts: any = {
        algorithms: [cfg.algorithm || "RS256"],
        clockTolerance: cfg.allowed_clock_skew_seconds ?? 30,
      };
      if (cfg.issuer) opts.issuer = cfg.issuer;
      if (cfg.audience) opts.audience = cfg.audience;

      if (cfg.jwks_url) {
        const JWKS = createRemoteJWKSet(new URL(cfg.jwks_url));
        const verified = await jwtVerify(token, JWKS, opts);
        payload = verified.payload;
        header = verified.protectedHeader;
      } else if (cfg.public_key) {
        const key = await importSPKI(cfg.public_key, cfg.algorithm || "RS256");
        const verified = await jwtVerify(token, key, opts);
        payload = verified.payload;
        header = verified.protectedHeader;
      } else {
        errors.push("No JWKS URL or public key configured");
      }
    } catch (e: any) {
      errors.push(e?.message || "Verification failed");
    }

    const mapped = payload
      ? {
          email: payload[cfg.claim_email || "email"] ?? null,
          full_name: payload[cfg.claim_full_name || "name"] ?? null,
          external_id: payload[cfg.claim_user_id || "sub"] ?? null,
          role: payload[cfg.claim_role || "role"] ?? cfg.default_role ?? "mentee",
        }
      : null;

    return new Response(
      JSON.stringify({ ok: errors.length === 0, errors, header, payload, mapped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, errors: [e?.message || "Server error"] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
