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
    const { application_id, admin_notes } = body || {};
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
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

    if (!existing?.id) {
      return new Response(
        JSON.stringify({ error: "No user account found for this email. Applicant may not have completed signup." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mentorUserId = existing.id;

    // Ensure mentor role + activate profile
    await admin.from("user_roles").upsert(
      { user_id: mentorUserId, role: "mentor" },
      { onConflict: "user_id,role" }
    );
    await admin.from("users").update({ role: "mentor", full_name: app.full_name }).eq("id", mentorUserId);

    // Generate slug from applicant's full name
    const { data: slugData } = await admin.rpc("generate_mentor_slug", {
      _full_name: app.full_name,
      _user_id: mentorUserId,
    });
    const mentorSlug = (slugData as string | null) ?? null;

    await admin.from("mentor_profiles").upsert(
      {
        user_id: mentorUserId,
        bio: app.bio,
        expertise: app.expertise,
        years_experience: app.years_experience,
        linkedin_url: app.linkedin_url ?? "",
        portfolio_url: app.portfolio_url ?? "",
        phone: app.phone ?? "",
        resume_url: app.resume_url ?? "",
        is_active: true,
        approval_acknowledged_at: null,
        slug: mentorSlug,
        current_organization: app.current_organization ?? "",
        current_role: app.current_role ?? "",
        professional_status: app.professional_status ?? "",
      },
      { onConflict: "user_id" }
    );

    await admin
      .from("mentor_applications")
      .update({
        status: "approved",
        admin_notes: admin_notes ?? null,
        reviewed_by: userData.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application_id);

    // Delete any other historical applications for the same email (e.g. previous rejections)
    await admin
      .from("mentor_applications")
      .delete()
      .ilike("email", app.email)
      .neq("id", application_id);


    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action: "approve_mentor_application",
      entity_type: "mentor_applications",
      entity_id: application_id,
      details: { mentor_user_id: mentorUserId, email: app.email },
    });

    // Queue outbound event for EduBridge sync
    await admin.from("outbound_events").insert({
      event_type: "mentor.approved",
      payload: {
        mentor_user_id: mentorUserId,
        email: app.email,
        full_name: app.full_name,
        slug: mentorSlug,
      },
    });

    // Fire decision email (don't fail approval if email fails)
    try {
      await admin.functions.invoke("mentor-application-decision-email", {
        body: { application_id, decision: "approved", notes: admin_notes ?? "" },
        headers: { Authorization: authHeader },
      });
    } catch (e) {
      console.warn("decision email failed", e);
    }

    return new Response(JSON.stringify({ success: true, mentor_user_id: mentorUserId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
