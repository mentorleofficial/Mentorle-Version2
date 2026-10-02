-- Access rules called auth.uid(), auth.jwt() and has_role() once per row. Wrapping them in
-- (SELECT ...) makes Postgres evaluate them once per statement; the rules themselves are
-- unchanged. Generated from pg_policies; payment and membership tables are left as they are.
-- The five dropped policies are each fully covered by another policy on the same table.
SET search_path = public, extensions;

DROP POLICY IF EXISTS "event_participants_user_policy" ON public.event_participants;

DROP POLICY IF EXISTS "Subject can view feedback about them" ON public.feedback;

DROP POLICY IF EXISTS "Mentors read own profile" ON public.mentor_profiles;

DROP POLICY IF EXISTS "Program mentors read program mentees" ON public.program_mentees;

DROP POLICY IF EXISTS "Mentees read mentors in their programs" ON public.program_mentors;

ALTER POLICY "Admins read audit logs" ON public.audit_logs
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins manage badges" ON public.badges
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Anyone can read active badges" ON public.badges
  USING (((is_active = true) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "Admins can update branding" ON public.branding
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins manage retention settings" ON public.data_retention_settings
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins full access on DSRs" ON public.data_subject_requests
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Users create own DSRs" ON public.data_subject_requests
  WITH CHECK (((user_id = (SELECT auth.uid())) AND (status = 'pending'::dsr_status)));

ALTER POLICY "Users read own DSRs" ON public.data_subject_requests
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users can read own registrations" ON public.event_participants
  USING (((user_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (EXISTS ( SELECT 1
   FROM events_programs ep
  WHERE ((ep.id = event_participants.event_id) AND (ep.created_by = (SELECT auth.uid())))))));

ALTER POLICY "Users can register for events" ON public.event_participants
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users or event creators can delete registrations" ON public.event_participants
  USING (((user_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR (EXISTS ( SELECT 1
   FROM events_programs ep
  WHERE ((ep.id = event_participants.event_id) AND (ep.created_by = (SELECT auth.uid())))))));

ALTER POLICY "Mentors can manage own events" ON public.events_programs
  USING (((created_by = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))))
  WITH CHECK (((created_by = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "Admins full access on feedback" ON public.feedback
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees read feedback about them" ON public.feedback
  USING (((audience = 'mentee'::feedback_audience) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentee_id = (SELECT auth.uid())))))));

ALTER POLICY "Mentees submit mentor feedback" ON public.feedback
  WITH CHECK (((submitted_by = (SELECT auth.uid())) AND (audience = 'mentor'::feedback_audience) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentee_id = (SELECT auth.uid())))))));

ALTER POLICY "Mentors read feedback about them" ON public.feedback
  USING (((audience = 'mentor'::feedback_audience) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentor_id = (SELECT auth.uid())))))));

ALTER POLICY "Mentors submit mentee feedback" ON public.feedback
  WITH CHECK (((submitted_by = (SELECT auth.uid())) AND (audience = ANY (ARRAY['mentee'::feedback_audience, 'admin_private'::feedback_audience])) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentor_id = (SELECT auth.uid())))))));

ALTER POLICY "Subject can respond to feedback about them" ON public.feedback
  USING (is_feedback_subject(id, (SELECT auth.uid())))
  WITH CHECK (is_feedback_subject(id, (SELECT auth.uid())));

ALTER POLICY "Users read own submitted feedback" ON public.feedback
  USING ((submitted_by = (SELECT auth.uid())));

ALTER POLICY "Admins update general feedback" ON public.general_feedback
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins view all general feedback" ON public.general_feedback
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Users insert own general feedback" ON public.general_feedback
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users view own general feedback" ON public.general_feedback
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Admins full access on jwt_config" ON public.jwt_config
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees can add their own favorites" ON public.mentee_favorites
  WITH CHECK (((SELECT auth.uid()) = mentee_id));

ALTER POLICY "Mentees can delete their own favorites" ON public.mentee_favorites
  USING (((SELECT auth.uid()) = mentee_id));

ALTER POLICY "Mentees can view their own favorites" ON public.mentee_favorites
  USING (((SELECT auth.uid()) = mentee_id));

ALTER POLICY "Admins full access on mentee_profiles" ON public.mentee_profiles
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees manage own profile" ON public.mentee_profiles
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "Admins delete applications" ON public.mentor_applications
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins read applications" ON public.mentor_applications
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins update applications" ON public.mentor_applications
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Applicants read own applications" ON public.mentor_applications
  USING ((lower(email) = lower(((SELECT auth.jwt()) ->> 'email'::text))));

ALTER POLICY "Applicants update own applications" ON public.mentor_applications
  USING ((lower(email) = lower(((SELECT auth.jwt()) ->> 'email'::text))))
  WITH CHECK ((lower(email) = lower(((SELECT auth.jwt()) ->> 'email'::text))));

ALTER POLICY "Admins full access on mentor_availability" ON public.mentor_availability
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentors manage own availability" ON public.mentor_availability
  USING ((mentor_id = (SELECT auth.uid())))
  WITH CHECK ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Admins full access on mentor_availability_overrides" ON public.mentor_availability_overrides
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentors manage own overrides" ON public.mentor_availability_overrides
  USING ((mentor_id = (SELECT auth.uid())))
  WITH CHECK ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Admins manage mentor_badges" ON public.mentor_badges
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins manage leaderboard" ON public.mentor_leaderboard_stats
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins full access on mentor_mentee_assignments" ON public.mentor_mentee_assignments
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees read own assignment" ON public.mentor_mentee_assignments
  USING ((mentee_id = (SELECT auth.uid())));

ALTER POLICY "Mentors read own assignments" ON public.mentor_mentee_assignments
  USING ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Admins full access on mentor_profiles" ON public.mentor_profiles
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentors manage own profile" ON public.mentor_profiles
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "Anyone can read active offerings" ON public.mentorship_offerings
  USING (((status = 'active'::text) OR (mentor_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "Mentors manage own offerings" ON public.mentorship_offerings
  USING (((mentor_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))))
  WITH CHECK (((mentor_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "Admins can manage notifications" ON public.notifications
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Users can delete their own notifications" ON public.notifications
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users can update their own notifications" ON public.notifications
  USING (((SELECT auth.uid()) = user_id))
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "Users can view their own notifications" ON public.notifications
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Admins manage privacy policy" ON public.privacy_policy
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Admins full access on program_mentees" ON public.program_mentees
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees read own program enrollments" ON public.program_mentees
  USING ((mentee_id = (SELECT auth.uid())));

ALTER POLICY "Mentors read mentees in their programs" ON public.program_mentees
  USING (is_program_mentor(program_id, (SELECT auth.uid())));

ALTER POLICY "Admins full access on program_mentors" ON public.program_mentors
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentors read own program memberships" ON public.program_mentors
  USING ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Program members read program mentors" ON public.program_mentors
  USING (is_program_member(program_id, (SELECT auth.uid())));

ALTER POLICY "Admins full access on program_tags" ON public.program_tags
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Members read program_tags" ON public.program_tags
  USING (((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR is_program_member(program_id, (SELECT auth.uid()))));

ALTER POLICY "Admins full access on programs" ON public.programs
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Members read their programs" ON public.programs
  USING (is_program_member(id, (SELECT auth.uid())));

ALTER POLICY "Admins full access on session_action_items" ON public.session_action_items
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees read own session action items" ON public.session_action_items
  USING ((mentee_id = (SELECT auth.uid())));

ALTER POLICY "Mentees update own action item status" ON public.session_action_items
  USING ((mentee_id = (SELECT auth.uid())))
  WITH CHECK ((mentee_id = (SELECT auth.uid())));

ALTER POLICY "Mentors manage own session action items" ON public.session_action_items
  USING ((mentor_id = (SELECT auth.uid())))
  WITH CHECK ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Admins full access on sessions" ON public.sessions
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees book sessions" ON public.sessions
  WITH CHECK (((mentee_id = (SELECT auth.uid())) AND can_mentee_book_mentor((SELECT auth.uid()), mentor_id)));

ALTER POLICY "Mentees cancel own sessions" ON public.sessions
  USING ((mentee_id = (SELECT auth.uid())))
  WITH CHECK (((mentee_id = (SELECT auth.uid())) AND (status = 'cancelled'::session_status)));

ALTER POLICY "Mentees read own sessions" ON public.sessions
  USING ((mentee_id = (SELECT auth.uid())));

ALTER POLICY "Mentors read own sessions" ON public.sessions
  USING ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Mentors update own sessions" ON public.sessions
  USING ((mentor_id = (SELECT auth.uid())));

ALTER POLICY "Admins read consents" ON public.user_consents
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Users insert own consents" ON public.user_consents
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users read own consents" ON public.user_consents
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "Users withdraw own consent" ON public.user_consents
  USING ((user_id = (SELECT auth.uid())))
  WITH CHECK ((user_id = (SELECT auth.uid())));

ALTER POLICY "Admins full access on user_roles" ON public.user_roles
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Users read own roles" ON public.user_roles
  USING ((user_id = (SELECT auth.uid())));

ALTER POLICY "Admins full access on users" ON public.users
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Mentees read users of program mentors" ON public.users
  USING (((is_disabled = false) AND (EXISTS ( SELECT 1
   FROM (program_mentors pmt
     JOIN program_mentees pme ON ((pme.program_id = pmt.program_id)))
  WHERE ((pmt.mentor_id = users.id) AND (pme.mentee_id = (SELECT auth.uid())))))));

ALTER POLICY "Mentees/Mentors read sessions counterparty users" ON public.users
  USING (((is_disabled = false) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE (((s.mentor_id = users.id) AND (s.mentee_id = (SELECT auth.uid()))) OR ((s.mentee_id = users.id) AND (s.mentor_id = (SELECT auth.uid()))))))));

ALTER POLICY "Mentors read users of program mentees" ON public.users
  USING (((is_disabled = false) AND (EXISTS ( SELECT 1
   FROM (program_mentees pm
     JOIN program_mentors pmt ON ((pmt.program_id = pm.program_id)))
  WHERE ((pm.mentee_id = users.id) AND (pmt.mentor_id = (SELECT auth.uid())))))));

ALTER POLICY "Users read own profile" ON public.users
  USING ((id = (SELECT auth.uid())));

ALTER POLICY "Users update own profile" ON public.users
  USING ((id = (SELECT auth.uid())))
  WITH CHECK ((id = (SELECT auth.uid())));

-- Indexes for the lookups the app and the RLS policies above run most.
CREATE INDEX IF NOT EXISTS idx_sessions_mentee_scheduled ON public.sessions (mentee_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor_scheduled ON public.sessions (mentor_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor ON public.mentor_availability (mentor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted_by ON public.feedback (submitted_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (lower(email));
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants (user_id);

-- Duplicates of an existing unique index, or unused.
DROP INDEX IF EXISTS public.idx_mentee_profiles_user_id;
DROP INDEX IF EXISTS public.idx_event_participants;
DROP INDEX IF EXISTS public.idx_favorites_mentee_id;
DROP INDEX IF EXISTS public.mentor_badges_mentor_idx;
DROP INDEX IF EXISTS public.idx_event_participants_progress_data;
DROP INDEX IF EXISTS public.idx_event_participants_completion_status;
