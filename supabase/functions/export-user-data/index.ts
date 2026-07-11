import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bundle owned rows
    const admin = createClient(supabaseUrl, serviceKey);
    const uid = user.id;

    const [profile, roles, mentor, mentee, availability, overrides, sessionsAsMentor, sessionsAsMentee, feedbackByMe, actionItemsMentor, actionItemsMentee, consents, dsrs] =
      await Promise.all([
        admin.from("users").select("*").eq("id", uid).maybeSingle(),
        admin.from("user_roles").select("*").eq("user_id", uid),
        admin.from("mentor_profiles").select("*").eq("user_id", uid).maybeSingle(),
        admin.from("mentee_profiles").select("*").eq("user_id", uid).maybeSingle(),
        admin.from("mentor_availability").select("*").eq("mentor_id", uid),
        admin.from("mentor_availability_overrides").select("*").eq("mentor_id", uid),
        admin.from("sessions").select("*").eq("mentor_id", uid),
        admin.from("sessions").select("*").eq("mentee_id", uid),
        admin.from("feedback").select("*").eq("submitted_by", uid),
        admin.from("session_action_items").select("*").eq("mentor_id", uid),
        admin.from("session_action_items").select("*").eq("mentee_id", uid),
        admin.from("user_consents").select("*").eq("user_id", uid),
        admin.from("data_subject_requests").select("*").eq("user_id", uid),
      ]);

    const payload = {
      generated_at: new Date().toISOString(),
      user_id: uid,
      profile: profile.data,
      roles: roles.data,
      mentor_profile: mentor.data,
      mentee_profile: mentee.data,
      availability: availability.data,
      availability_overrides: overrides.data,
      sessions: [...(sessionsAsMentor.data ?? []), ...(sessionsAsMentee.data ?? [])],
      feedback_submitted: feedbackByMe.data,
      action_items: [...(actionItemsMentor.data ?? []), ...(actionItemsMentee.data ?? [])],
      consents: consents.data,
      privacy_requests: dsrs.data,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
