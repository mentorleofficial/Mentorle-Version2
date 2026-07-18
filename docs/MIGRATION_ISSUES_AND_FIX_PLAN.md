# Mentorle-Version2 — Migration Issues & Fix Plan

**Date:** 2026-07-17
**Scope:** Why mentor approval, user deletion, and other flows are broken after moving from Edubridge to the new Mentorle-v2 Supabase project.

> **Execution status (2026-07-17):**
> - **Deployed & verified live (10/11 functions):** admin-manage-user, approve/reject-mentor-application,
>   request-application-changes, mentor-application-decision-email, send-booking-email, send-feedback-request,
>   send-session-reminders (now guarded by `x-cron-secret`), export-user-data, refresh-mentor-engagement.
>   Endpoint probes confirm each responds (401/500-config instead of the previous 404s).
> - **Repo changes:** migrations `20260717130000_security_lockdown_legacy_tables.sql` +
>   `20260717131000_post_migration_data_repairs.sql`; `config.toml` (project id → xykindgwltvgcrcuwmik,
>   verify_jwt=false for reject/request-changes/reminders); CRON_SECRET guard in send-session-reminders;
>   admin-manage-user fallback URL → platform.mentorle.in; `supabase/snippets/reschedule_session_reminders.sql`.
> - **2026-07-18 — phases 0–4 complete and verified live:**
>   - All 11 functions deployed; secrets set; lockdown + repairs applied (legacy tables now 42501 for anon;
>     slugs 0 NULL; users backfilled; stuck application approved via the UI).
>   - **Phase 3 done:** all 25 old-project avatars copied into `branding-assets/avatars/<uid>/` and
>     `users.avatar_url` rewritten (7 expired signed URLs recovered via the public path) — `scripts/migrate-avatars.mjs`.
>   - **Phase 4 done:** `types.ts` regenerated from the live DB (typecheck clean); EduBridge admin tab +
>     component removed. JWT/SSO components kept (feature flagged off). The inert `outbound_events` insert
>     in `approve-mentor-application` was left as-is (harmless; table exists).
>   - **One pending step:** `npx supabase db push --linked` to apply
>     `20260718100000_enrich_mentee_profiles_from_legacy.sql` — copies bio/phone/links/education/work/
>     preferences from `mentee_data` into `mentee_profiles` (backfill had dropped them; verified: bio 18→1,
>     linkedin 8→0) and marks mentees with any substantive legacy data (incl. skills) as onboarded.
> - **Still open:** M6 auth-config once-over in the dashboard (Site URL, redirect URLs, SMTP);
>   legacy-table archival after a parity window (Phase 5); optionally delete the old
>   `zzocepwobcnmflkewzss` / `uibbavdzxmictgqdcuny` projects once nothing references them.

---

## How this system got here (context)

1. This codebase is a clone of the **Edubrige** app (Lovable-built), whose original Supabase project is `uibbavdzxmictgqdcuny`.
2. A **new Supabase project "Mentorle-v2"** (`xykindgwltvgcrcuwmik`, ap-south-1) was created ~2026-07-11 and the repo's Edubridge migrations were pushed to it (all 44 migration files, RPCs, storage buckets — verified present).
3. The **old mentorle.in database** (project `zzocepwobcnmflkewzss`) was dumped (`c:\Programming\BeezTech\db backup\mentorle_backup.sql` + `mentorle_data.sql`) and imported into Mentorle-v2 **with `session_replication_role = replica`** — i.e. all triggers (including `handle_new_user`) were bypassed.
4. A backfill mapped legacy data into the Edubridge-shaped tables. Verified live counts: `auth.users` 309, `public.users` 294, `user_roles` 295 (2 admins), `mentor_profiles` 44, `mentee_profiles` 249, `sessions` 31.
5. Legacy tables now **coexist** with the new schema: `mentor_data`, `mentee_data`, `admin_data`, `mentorship_bookings`, `user_subscriptions`, `posts`, `events`, `event_organizers`, `roles`, plus renamed `old_user_roles`, `old_feedback`, `old_mentor_availability`. Where names collided, the shape that existed first won (`CREATE TABLE IF NOT EXISTS` skipped): notably `events_programs` kept the **legacy** shape and its **legacy FK** to `auth.users`.

All findings below were verified against the **live** database/API (read-only probes), not just the code.

---

## CRITICAL

### C1. Zero edge functions deployed, zero secrets set  ← root cause of "mentor approval, deleting users, etc."

`supabase functions list` on `xykindgwltvgcrcuwmik` returns **empty**; every one of the 14 functions the frontend invokes returns `404 {"code":"NOT_FOUND"}` (verified individually). `supabase secrets list` is also empty (no `BREVO_API_KEY`).

Broken as a direct result:
- Approve / reject / request-changes on mentor applications (the one pending application from 2026-07-14 is stuck).
- Admin user management: create, invite, disable, restore, **delete** (`admin-manage-user`).
- All e-mails: application submitted/decision, booking confirmations, feedback requests, session reminders.
- `export-user-data` (privacy page), `refresh-mentor-engagement` (leaderboard/badges).

**Fix**
```powershell
cd c:\Programming\BeezTech\Mentorle-Version2
# 1) secrets first (get BREVO key from the old Edubridge project's dashboard → Edge Functions → Secrets)
npx supabase secrets set BREVO_API_KEY=<value> --project-ref xykindgwltvgcrcuwmik
# 2) deploy the functions that are actually used
npx supabase functions deploy admin-manage-user approve-mentor-application reject-mentor-application `
  request-application-changes mentor-application-submitted-email mentor-application-decision-email `
  send-booking-email send-feedback-request send-session-reminders export-user-data refresh-mentor-engagement `
  --project-ref xykindgwltvgcrcuwmik
```
Deliberately **skip** `sync-to-edubridge`, `jwt-exchange`, `validate-jwt-config` (see C3).
Before deploying, apply the config fixes in M2/M3 so `verify_jwt` settings ship correctly.

### C2. Legacy tables are publicly readable (and almost certainly writable) by anonymous users

Verified with the **anon key** (what any visitor's browser holds): full row access to
`mentee_data` (248 rows — emails, phones, education, goals), `mentor_data` (43 — emails, phones, bios), `admin_data` (2), `mentorship_bookings` (31 — meeting links/notes), `user_subscriptions` (30 — payment details), `old_user_roles` (296), `old_mentor_availability` (139), `roles`, `events`, `event_organizers`.
Cause: the dump recreated these tables with `GRANT ALL … TO anon/authenticated` and **RLS disabled**. `GRANT ALL` includes INSERT/UPDATE/DELETE, so assume write access too.

**Fix (run in SQL editor, same day):**
```sql
-- Lock down legacy tables the app does NOT use
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mentor_data','mentee_data','admin_data','mentorship_bookings','user_subscriptions',
    'old_user_roles','old_feedback','old_mentor_availability','roles','events','event_organizers',
    'posts','post_comments','post_likes','post_views','comment_likes','feedbacks','institutions','mentor_payouts'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;
```
Do **not** revoke on `events_programs` / `event_participants` — the app actively uses them (`src/features/mentor-events`); instead confirm their RLS policies (from `20260607120000_add_events.sql`) are active and correct.
Longer term: archive-then-drop the legacy tables once parity is confirmed (dumps exist in `db backup\`).

### C3. Edubridge-era dead weight still wired in

- `sync-to-edubridge` function + `outbound_events` insert inside `approve-mentor-application` (queues events for a webhook that is disabled: `branding.edubridge_enabled=false`).
- `jwt-exchange`, `validate-jwt-config`, `JwtSettings`, `JwtCallback` (SSO from Edubridge; `jwt_config.enabled=false`).
- `EdubridgeSettings.tsx` admin tab, "EduBridge" copy on the login page (`src/pages/Login.tsx:107`).

Currently inert (flags off), so this is cleanup, not breakage — remove the UI/function code or consciously keep it disabled. Don't deploy those functions.

---

## HIGH

### H1. User deletion will still fail for some users after C1 is fixed

`admin-manage-user` calls `auth.admin.deleteUser()`, which requires every FK to `auth.users` to cascade. The live `events_programs` kept the **legacy** constraint `events_programs_created_by_fkey → auth.users(id)` with **no ON DELETE action** — deleting any user who created one of the 3 live `events_programs` rows will fail with "Database error deleting user".

**Fix:**
```sql
ALTER TABLE public.events_programs
  DROP CONSTRAINT events_programs_created_by_fkey,
  ADD CONSTRAINT events_programs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Audit for any other non-cascading FK to auth.users:
SELECT conrelid::regclass AS child, confdeltype
FROM pg_constraint
WHERE contype='f' AND confrelid='auth.users'::regclass AND confdeltype NOT IN ('c','n');
```
Also note `admin_data` has **no FK** — deleting an admin leaves orphan rows there (cosmetic).

### H2. Six confirmed auth users have no `public.users` row

`pm@appsrow.com`, `mannatveer98@gmail.com`, `karanthhamsini@gmail.com`, `niggeshwarsandhu@gmail.com`, `datanod599@exitbit.com`, `rachitjain.eth@gmail.com`.
Consequences: invisible in the admin user list, broken profile on login, and `approve-mentor-application` returns "No user account found for this email" for them (it looks up `public.users` by email).

**Fix (backfill; or delete the stale accounts via dashboard):**
```sql
INSERT INTO public.users (id, email, full_name, role)
SELECT au.id, au.email,
       COALESCE(au.raw_user_meta_data->>'full_name',''),
       COALESCE((au.raw_user_meta_data->>'role')::app_role,'mentee')
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL AND au.email_confirmed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, u.role FROM public.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
```

### H3. All 248 imported mentees are forced through onboarding again

`mentee_profiles.onboarded_at` is NULL for every imported mentee, and `MenteeOnboardingGuard` redirects to `/onboarding/mentee` whenever `onboarded_at` is null — even though their imported profiles are complete.

**Fix:**
```sql
UPDATE public.mentee_profiles
SET onboarded_at = created_at
WHERE onboarded_at IS NULL
  AND (goals <> '' OR COALESCE(array_length(interests,1),0) > 0 OR bio <> '');
```
(Leave truly-empty profiles null so those users do get the wizard.)

### H4. All 44 mentor slugs are NULL → public profile links 404

`list_public_mentors` works (36 active mentors returned), but `PublicMentorProfile` / `get_public_mentor` resolve by `slug`, so every "view profile" deep link fails.

**Fix:**
```sql
UPDATE public.mentor_profiles mp
SET slug = public.generate_mentor_slug(u.full_name, mp.user_id)
FROM public.users u
WHERE u.id = mp.user_id AND mp.slug IS NULL;
```
(Signature per `generate_mentor_slug(_full_name, _user_id)`; run a `SELECT` first to confirm arg names.)

### H5. Reminder cron fires every minute at a guaranteed-404 URL

Migration `20260607110000` scheduled `send-session-reminders-job` (`* * * * *`). It builds the URL as `branding.supabase_api_url + '/functions/v1/send-session-reminders'`, and live `branding.supabase_api_url` = `https://xykindgwltvgcrcuwmik.supabase.co/rest/v1/` → the call goes to `/rest/v1//functions/v1/...` → 404, 1 440 times/day (these are a chunk of the "edge function errors" you're seeing). The function isn't deployed either, and the cron sends no auth header while the function's gateway default is `verify_jwt = true` — three stacked failures.

**Fix:**
```sql
-- pause it until the function is deployed and configured
SELECT cron.unschedule('send-session-reminders-job');
-- after deploy: fix the base URL (no /rest/v1/)
UPDATE public.branding SET supabase_api_url = 'https://xykindgwltvgcrcuwmik.supabase.co';
-- re-schedule (same command as in migration 20260607110000)
```
Plus: add `[functions.send-session-reminders] verify_jwt = false` to `supabase/config.toml` **and** add an internal guard to the function (e.g. require an `x-cron-secret` header checked against a secret) so it isn't publicly triggerable.

### H6. Imported avatars point at the old mentorle.in project

25 of 27 non-null `users.avatar_url` values reference `zzocepwobcnmflkewzss.supabase.co`. If that project is paused/deleted (free-tier projects pause automatically), all those avatars break. No resumes were migrated at all (`mentor_profiles.resume_url` is empty everywhere).

**Fix:** script a one-time copy — download each referenced object, upload into this project's `media`/`mentor-resumes` bucket, rewrite `users.avatar_url`. Do this while the old project is still reachable.

---

## MEDIUM

### M1. `has_role()` not executable by `anon` — RESOLVED AS INTENTIONAL, no action

Anon `SELECT` on `mentorship_offerings`/`badges` fails with `42501 permission denied for function has_role`. Root cause found: migration `20260516151559` **deliberately** revoked EXECUTE on internal helpers (`has_role`, `is_program_member`, …) from `anon` to prevent direct RPC probing. The behavior existed on Edubridge too; `authenticated` users are unaffected, and all public pages read through SECURITY-DEFINER RPCs (`list_public_mentors`, `list_public_offerings` — both verified working as anon). **Do not re-grant.** If a public page ever needs direct anon reads on those tables, fix the table's anon policy instead (e.g. a plain `status = 'active'` clause without `has_role()`).

### M2. `config.toml` still points at the old Edubridge project

`project_id = "uibbavdzxmictgqdcuny"` — misleading and risks a future `supabase link`/deploy against the wrong project. Change to `xykindgwltvgcrcuwmik`.

### M3. `verify_jwt` gaps for review functions

`approve-mentor-application` got `verify_jwt = false` (with an explanatory comment about stale-token 401s), but `reject-mentor-application` and `request-application-changes` were never added — they'll intermittently 401 at the gateway for the same reason. Add both to `config.toml` (they do their own admin check internally, same as approve).

### M4. Stale generated types

`src/integrations/supabase/types.ts` is byte-identical to the Edubrige repo's — it predates the merge (code already needs `as any` for `events_programs`). Regenerate:
```powershell
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### M5. Wrong production-URL fallback in `admin-manage-user`

`getAppUrl()` falls back to `https://mentorle.vercel.app/`; the real site is `https://platform.mentorle.in/`. `branding.site_url` is set correctly so the fallback is rarely hit — still worth fixing before deploying, and confirm the Brevo sender `noreply@mentorle.in` is a verified sender in the Brevo account you set the key for.

### M6. Auth config on the new project needs a once-over

New project = fresh GoTrue config. Verify in the dashboard: Site URL = `https://platform.mentorle.in`, redirect URLs include `/reset-password` and the Vercel preview domains, OTP length 8 (config.toml expects it), and SMTP/custom sender if used previously. 80 unconfirmed auth accounts exist; the deferred `handle_new_user` trigger is live and working (the one post-migration signup got its profile row).

### M7. Approval celebration will pop for every imported mentor

43/44 `mentor_profiles.approval_acknowledged_at` are NULL and ~36 are active → `useApprovalCelebration` shows the "you're approved!" modal to every imported mentor on next login. Cosmetic:
```sql
UPDATE public.mentor_profiles SET approval_acknowledged_at = now()
WHERE approval_acknowledged_at IS NULL AND is_active = true;
```

---

## Recommended execution order

| Phase | Actions | Items |
|---|---|---|
| **0 — today (security/noise)** | Lock down legacy tables; unschedule reminder cron | C2, H5 (pause only) |
| **1 — restore admin flows** | Fix config.toml; set secrets; deploy functions; approve the stuck application; test create/disable/delete user end-to-end | M2, M3, C1 |
| **2 — data repairs (one SQL session)** | FK fix, users backfill, onboarded_at, slugs, has_role grant, acknowledged_at; re-enable cron with fixed URL + guarded function | H1–H4, M1, M7, H5 |
| **3 — assets** | Copy avatars from old project, rewrite URLs | H6 |
| **4 — hygiene** | Regenerate types; remove Edubridge dead weight + login copy; fix fallback URL; verify auth config | M4, C3, M5, M6 |
| **5 — later** | Archive & drop legacy tables after 2–4 weeks of parity; delete or keep old projects consciously | C2 tail |

**Verification checklist after phases 1–2** (each was broken or at risk):
1. Approve the pending application → applicant becomes active mentor with slug, gets email.
2. Reject + request-changes on a test application (no gateway 401).
3. Admin: invite user (email arrives), disable/restore, delete a test user **who created an event**.
4. Mentee login → lands on dashboard, not onboarding wizard.
5. Public mentor directory → open a mentor profile by link (slug resolves).
6. Logged-out browse of offerings page (no has_role error in console).
7. Book a session → booking email; wait for reminder window → reminder email; `cron.job_run_details` shows succeeded.
8. Anon PostgREST probe of `mentee_data` returns permission denied.
