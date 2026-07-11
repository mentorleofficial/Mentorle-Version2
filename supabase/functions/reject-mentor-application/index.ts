import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { application_id, rejection_reason } = body || {};
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rejection_reason) {
      return new Response(JSON.stringify({ error: "rejection_reason required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: app, error: appErr } = await admin
      .from("mentor_applications")
      .select("*")
      .eq("id", application_id)
      .single();
    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (app.status === "approved" || app.status === "rejected") {
      return new Response(JSON.stringify({ error: `Application already reviewed with status: ${app.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the existing user (created during apply via signUp)
    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("email", app.email)
      .maybeSingle();

    if (existing?.id) {
      await admin.from("notifications").insert({
        user_id: existing.id,
        title: "Application Status Update",
        message: `Your mentor application has been reviewed. Status: Rejected. Reason: ${rejection_reason}`,
        type: "application_status",
      });
    }

    await admin
      .from("mentor_applications")
      .update({
        status: "rejected",
        rejection_reason: rejection_reason,
        admin_notes: rejection_reason,
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application_id);

    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "reject_mentor_application",
      entity_type: "mentor_applications",
      entity_id: application_id,
      details: { email: app.email, rejection_reason },
    });

    // Fire decision email (don't fail rejection if email fails)
    try {
      await admin.functions.invoke("mentor-application-decision-email", {
        body: { application_id, decision: "rejected", notes: rejection_reason },
        headers: { Authorization: authHeader },
      });
    } catch (e) {
      console.warn("decision email failed", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
