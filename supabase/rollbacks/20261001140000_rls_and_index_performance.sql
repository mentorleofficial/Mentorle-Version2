-- Undo 20261001140000: restore the original policy expressions, the five removed
-- policies, and the original index set.
SET search_path = public, extensions;

ALTER POLICY "Admins read audit logs" ON public.audit_logs
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins manage badges" ON public.badges
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Anyone can read active badges" ON public.badges
  USING (((is_active = true) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER POLICY "Admins can update branding" ON public.branding
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins manage retention settings" ON public.data_retention_settings
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins full access on DSRs" ON public.data_subject_requests
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Users create own DSRs" ON public.data_subject_requests
  WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::dsr_status)));

ALTER POLICY "Users read own DSRs" ON public.data_subject_requests
  USING ((user_id = auth.uid()));

ALTER POLICY "Users can read own registrations" ON public.event_participants
  USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM events_programs ep
  WHERE ((ep.id = event_participants.event_id) AND (ep.created_by = auth.uid()))))));

ALTER POLICY "Users can register for events" ON public.event_participants
  WITH CHECK ((user_id = auth.uid()));

ALTER POLICY "Users or event creators can delete registrations" ON public.event_participants
  USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM events_programs ep
  WHERE ((ep.id = event_participants.event_id) AND (ep.created_by = auth.uid()))))));

CREATE POLICY "event_participants_user_policy" ON public.event_participants AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id));

ALTER POLICY "Mentors can manage own events" ON public.events_programs
  USING (((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER POLICY "Admins full access on feedback" ON public.feedback
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees read feedback about them" ON public.feedback
  USING (((audience = 'mentee'::feedback_audience) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentee_id = auth.uid()))))));

ALTER POLICY "Mentees submit mentor feedback" ON public.feedback
  WITH CHECK (((submitted_by = auth.uid()) AND (audience = 'mentor'::feedback_audience) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentee_id = auth.uid()))))));

ALTER POLICY "Mentors read feedback about them" ON public.feedback
  USING (((audience = 'mentor'::feedback_audience) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentor_id = auth.uid()))))));

ALTER POLICY "Mentors submit mentee feedback" ON public.feedback
  WITH CHECK (((submitted_by = auth.uid()) AND (audience = ANY (ARRAY['mentee'::feedback_audience, 'admin_private'::feedback_audience])) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = feedback.session_id) AND (s.mentor_id = auth.uid()))))));

ALTER POLICY "Subject can respond to feedback about them" ON public.feedback
  USING (is_feedback_subject(id, auth.uid()))
  WITH CHECK (is_feedback_subject(id, auth.uid()));

CREATE POLICY "Subject can view feedback about them" ON public.feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_feedback_subject(id, auth.uid()));

ALTER POLICY "Users read own submitted feedback" ON public.feedback
  USING ((submitted_by = auth.uid()));

ALTER POLICY "Admins update general feedback" ON public.general_feedback
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins view all general feedback" ON public.general_feedback
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Users insert own general feedback" ON public.general_feedback
  WITH CHECK ((auth.uid() = user_id));

ALTER POLICY "Users view own general feedback" ON public.general_feedback
  USING ((auth.uid() = user_id));

ALTER POLICY "Admins full access on jwt_config" ON public.jwt_config
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees can add their own favorites" ON public.mentee_favorites
  WITH CHECK ((auth.uid() = mentee_id));

ALTER POLICY "Mentees can delete their own favorites" ON public.mentee_favorites
  USING ((auth.uid() = mentee_id));

ALTER POLICY "Mentees can view their own favorites" ON public.mentee_favorites
  USING ((auth.uid() = mentee_id));

ALTER POLICY "Admins full access on mentee_profiles" ON public.mentee_profiles
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees manage own profile" ON public.mentee_profiles
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER POLICY "Admins delete applications" ON public.mentor_applications
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins read applications" ON public.mentor_applications
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins update applications" ON public.mentor_applications
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Applicants read own applications" ON public.mentor_applications
  USING ((lower(email) = lower((auth.jwt() ->> 'email'::text))));

ALTER POLICY "Applicants update own applications" ON public.mentor_applications
  USING ((lower(email) = lower((auth.jwt() ->> 'email'::text))))
  WITH CHECK ((lower(email) = lower((auth.jwt() ->> 'email'::text))));

ALTER POLICY "Admins full access on mentor_availability" ON public.mentor_availability
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentors manage own availability" ON public.mentor_availability
  USING ((mentor_id = auth.uid()))
  WITH CHECK ((mentor_id = auth.uid()));

ALTER POLICY "Admins full access on mentor_availability_overrides" ON public.mentor_availability_overrides
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentors manage own overrides" ON public.mentor_availability_overrides
  USING ((mentor_id = auth.uid()))
  WITH CHECK ((mentor_id = auth.uid()));

ALTER POLICY "Admins manage mentor_badges" ON public.mentor_badges
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins manage leaderboard" ON public.mentor_leaderboard_stats
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins full access on mentor_mentee_assignments" ON public.mentor_mentee_assignments
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees read own assignment" ON public.mentor_mentee_assignments
  USING ((mentee_id = auth.uid()));

ALTER POLICY "Mentors read own assignments" ON public.mentor_mentee_assignments
  USING ((mentor_id = auth.uid()));

ALTER POLICY "Admins full access on mentor_profiles" ON public.mentor_profiles
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentors manage own profile" ON public.mentor_profiles
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Mentors read own profile" ON public.mentor_profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

ALTER POLICY "Anyone can read active offerings" ON public.mentorship_offerings
  USING (((status = 'active'::text) OR (mentor_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER POLICY "Mentors manage own offerings" ON public.mentorship_offerings
  USING (((mentor_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (((mentor_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

ALTER POLICY "Admins can manage notifications" ON public.notifications
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Users can delete their own notifications" ON public.notifications
  USING ((auth.uid() = user_id));

ALTER POLICY "Users can update their own notifications" ON public.notifications
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

ALTER POLICY "Users can view their own notifications" ON public.notifications
  USING ((auth.uid() = user_id));

ALTER POLICY "Admins manage privacy policy" ON public.privacy_policy
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Admins full access on program_mentees" ON public.program_mentees
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees read own program enrollments" ON public.program_mentees
  USING ((mentee_id = auth.uid()));

ALTER POLICY "Mentors read mentees in their programs" ON public.program_mentees
  USING (is_program_mentor(program_id, auth.uid()));

CREATE POLICY "Program mentors read program mentees" ON public.program_mentees AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_program_mentor(program_id, auth.uid()));

ALTER POLICY "Admins full access on program_mentors" ON public.program_mentors
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentees read mentors in their programs" ON public.program_mentors AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM program_mentees pe
  WHERE ((pe.program_id = program_mentors.program_id) AND (pe.mentee_id = auth.uid())))));

ALTER POLICY "Mentors read own program memberships" ON public.program_mentors
  USING ((mentor_id = auth.uid()));

ALTER POLICY "Program members read program mentors" ON public.program_mentors
  USING (is_program_member(program_id, auth.uid()));

ALTER POLICY "Admins full access on program_tags" ON public.program_tags
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Members read program_tags" ON public.program_tags
  USING ((has_role(auth.uid(), 'admin'::app_role) OR is_program_member(program_id, auth.uid())));

ALTER POLICY "Admins full access on programs" ON public.programs
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Members read their programs" ON public.programs
  USING (is_program_member(id, auth.uid()));

ALTER POLICY "Admins full access on session_action_items" ON public.session_action_items
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees read own session action items" ON public.session_action_items
  USING ((mentee_id = auth.uid()));

ALTER POLICY "Mentees update own action item status" ON public.session_action_items
  USING ((mentee_id = auth.uid()))
  WITH CHECK ((mentee_id = auth.uid()));

ALTER POLICY "Mentors manage own session action items" ON public.session_action_items
  USING ((mentor_id = auth.uid()))
  WITH CHECK ((mentor_id = auth.uid()));

ALTER POLICY "Admins full access on sessions" ON public.sessions
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees book sessions" ON public.sessions
  WITH CHECK (((mentee_id = auth.uid()) AND can_mentee_book_mentor(auth.uid(), mentor_id)));

ALTER POLICY "Mentees cancel own sessions" ON public.sessions
  USING ((mentee_id = auth.uid()))
  WITH CHECK (((mentee_id = auth.uid()) AND (status = 'cancelled'::session_status)));

ALTER POLICY "Mentees read own sessions" ON public.sessions
  USING ((mentee_id = auth.uid()));

ALTER POLICY "Mentors read own sessions" ON public.sessions
  USING ((mentor_id = auth.uid()));

ALTER POLICY "Mentors update own sessions" ON public.sessions
  USING ((mentor_id = auth.uid()));

ALTER POLICY "Admins read consents" ON public.user_consents
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Users insert own consents" ON public.user_consents
  WITH CHECK ((user_id = auth.uid()));

ALTER POLICY "Users read own consents" ON public.user_consents
  USING ((user_id = auth.uid()));

ALTER POLICY "Users withdraw own consent" ON public.user_consents
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER POLICY "Admins full access on user_roles" ON public.user_roles
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Users read own roles" ON public.user_roles
  USING ((user_id = auth.uid()));

ALTER POLICY "Admins full access on users" ON public.users
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER POLICY "Mentees read users of program mentors" ON public.users
  USING (((is_disabled = false) AND (EXISTS ( SELECT 1
   FROM (program_mentors pmt
     JOIN program_mentees pme ON ((pme.program_id = pmt.program_id)))
  WHERE ((pmt.mentor_id = users.id) AND (pme.mentee_id = auth.uid()))))));

ALTER POLICY "Mentees/Mentors read sessions counterparty users" ON public.users
  USING (((is_disabled = false) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE (((s.mentor_id = users.id) AND (s.mentee_id = auth.uid())) OR ((s.mentee_id = users.id) AND (s.mentor_id = auth.uid())))))));

ALTER POLICY "Mentors read users of program mentees" ON public.users
  USING (((is_disabled = false) AND (EXISTS ( SELECT 1
   FROM (program_mentees pm
     JOIN program_mentors pmt ON ((pmt.program_id = pm.program_id)))
  WHERE ((pm.mentee_id = users.id) AND (pmt.mentor_id = auth.uid()))))));

ALTER POLICY "Users read own profile" ON public.users
  USING ((id = auth.uid()));

ALTER POLICY "Users update own profile" ON public.users
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

DROP INDEX IF EXISTS public.idx_sessions_mentee_scheduled;
DROP INDEX IF EXISTS public.idx_sessions_mentor_scheduled;
DROP INDEX IF EXISTS public.idx_mentor_availability_mentor;
DROP INDEX IF EXISTS public.idx_feedback_submitted_by;
DROP INDEX IF EXISTS public.idx_notifications_user_created;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_users_email_lower;
DROP INDEX IF EXISTS public.idx_event_participants_user;
CREATE INDEX idx_event_participants ON public.event_participants USING btree (event_id, user_id);
CREATE INDEX idx_event_participants_completion_status ON public.event_participants USING btree (completion_status);
CREATE INDEX idx_event_participants_progress_data ON public.event_participants USING gin (progress_data);
CREATE INDEX idx_favorites_mentee_id ON public.mentee_favorites USING btree (mentee_id);
CREATE INDEX idx_mentee_profiles_user_id ON public.mentee_profiles USING btree (user_id);
CREATE INDEX mentor_badges_mentor_idx ON public.mentor_badges USING btree (mentor_id);

