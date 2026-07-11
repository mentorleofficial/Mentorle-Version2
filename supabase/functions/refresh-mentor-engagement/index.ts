// Recomputes mentor leaderboard stats (last 30 days) and re-evaluates badge awards.
// Callable by any authenticated admin; service role used internally for writes.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Pull all mentors with active profiles
    const { data: mentors, error: mErr } = await admin
      .from("mentor_profiles")
      .select("user_id")
      .eq("is_active", true);
    if (mErr) throw mErr;

    // Pull all completed sessions in window
    const { data: sessions, error: sErr } = await admin
      .from("sessions")
      .select("id, mentor_id, mentee_id, status, scheduled_at")
      .eq("status", "completed")
      .gte("scheduled_at", since);
    if (sErr) throw sErr;

    // Pull all completed sessions ever (for badge thresholds)
    const { data: allSessions, error: asErr } = await admin
      .from("sessions")
      .select("id, mentor_id, mentee_id, status, scheduled_at")
      .eq("status", "completed");
    if (asErr) throw asErr;


    // Pull all mentor feedback
    const { data: feedback, error: fErr } = await admin
      .from("feedback")
      .select("rating, session_id")
      .eq("audience", "mentor");
    if (fErr) throw fErr;

    const sessionToMentor = new Map<string, string>();
    for (const s of allSessions ?? []) sessionToMentor.set(s.id, s.mentor_id);

    // Aggregate per mentor (30d and all-time)
    const ratingsByMentor30d = new Map<string, number[]>();
    const sessionsByMentor30d = new Map<string, { count: number; mentees: Set<string> }>();
    for (const s of sessions ?? []) {
      const cur = sessionsByMentor30d.get(s.mentor_id) ?? { count: 0, mentees: new Set() };
      cur.count += 1;
      cur.mentees.add(s.mentee_id);
      sessionsByMentor30d.set(s.mentor_id, cur);
    }
    const session30dIds = new Set((sessions ?? []).map((s) => s.id));
    for (const f of feedback ?? []) {
      if (!session30dIds.has(f.session_id)) continue;
      const mid = sessionToMentor.get(f.session_id);
      if (!mid) continue;
      const arr = ratingsByMentor30d.get(mid) ?? [];
      arr.push(f.rating);
      ratingsByMentor30d.set(mid, arr);
    }

    const allTimeByMentor = new Map<string, { count: number; mentees: Set<string> }>();
    for (const s of allSessions ?? []) {
      const cur = allTimeByMentor.get(s.mentor_id) ?? { count: 0, mentees: new Set() };
      cur.count += 1;
      cur.mentees.add(s.mentee_id);
      allTimeByMentor.set(s.mentor_id, cur);
    }
    const allRatingsByMentor = new Map<string, number[]>();
    for (const f of feedback ?? []) {
      const mid = sessionToMentor.get(f.session_id);
      if (!mid) continue;
      const arr = allRatingsByMentor.get(mid) ?? [];
      arr.push(f.rating);
      allRatingsByMentor.set(mid, arr);
    }

    // Upsert leaderboard rows
    const now = new Date().toISOString();
    const rows = (mentors ?? []).map((m) => {
      const s = sessionsByMentor30d.get(m.user_id);
      const ratings = ratingsByMentor30d.get(m.user_id) ?? [];
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const completed = s?.count ?? 0;
      const menteeCount = s?.mentees.size ?? 0;
      // Score: blend volume + quality + reach
      const score = completed * 10 + avg * 20 + menteeCount * 5;
      return {
        mentor_id: m.user_id,
        completed_sessions_30d: completed,
        avg_rating_30d: Number(avg.toFixed(2)),
        mentee_count_30d: menteeCount,
        score: Number(score.toFixed(2)),
        computed_at: now,
      };
    });

    if (rows.length) {
      const { error: upErr } = await admin
        .from("mentor_leaderboard_stats")
        .upsert(rows, { onConflict: "mentor_id" });
      if (upErr) throw upErr;
    }

    // Badge evaluation
    const { data: badges } = await admin.from("badges").select("id, code, criteria, is_active").eq("is_active", true);
    const awards: { mentor_id: string; badge_id: string; awarded_reason: string }[] = [];
    for (const m of mentors ?? []) {
      const all = allTimeByMentor.get(m.user_id);
      const ratings = allRatingsByMentor.get(m.user_id) ?? [];
      const avgAll = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const completed = all?.count ?? 0;
      const mentees = all?.mentees.size ?? 0;
      for (const b of badges ?? []) {
        const c = (b.criteria ?? {}) as Record<string, number>;
        const okSessions = completed >= (c.min_completed_sessions ?? 0);
        const okRating = avgAll >= (c.min_avg_rating ?? 0);
        const okMentees = mentees >= (c.min_mentee_count ?? 0);
        if (okSessions && okRating && okMentees) {
          awards.push({
            mentor_id: m.user_id,
            badge_id: b.id,
            awarded_reason: `Auto-awarded: ${completed} sessions, ${avgAll.toFixed(2)} avg rating, ${mentees} mentees`,
          });
        }
      }
    }
    if (awards.length) {
      const { error: bErr } = await admin
        .from("mentor_badges")
        .upsert(awards, { onConflict: "mentor_id,badge_id", ignoreDuplicates: true });
      if (bErr) throw bErr;
    }

    return json({ ok: true, mentors: rows.length, awards: awards.length });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
