-- ============================================================
-- Automatic notification triggers
-- Fires on sessions and mentor_applications to populate the
-- notifications table for mentors, mentees, and admins.
-- ============================================================

-- Allow users to delete their own notifications (needed for the "clear" button in NotificationBell)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'Users can delete their own notifications'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete their own notifications"
      ON public.notifications FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
    $policy$;
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- Helper: session notification trigger
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_session_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentor_name  TEXT;
  v_mentee_name  TEXT;
  v_title        TEXT;
  v_time_str     TEXT;
BEGIN
  SELECT full_name INTO v_mentor_name FROM users WHERE id = COALESCE(NEW.mentor_id, OLD.mentor_id);
  SELECT full_name INTO v_mentee_name FROM users WHERE id = COALESCE(NEW.mentee_id, OLD.mentee_id);
  v_title    := COALESCE(NULLIF(COALESCE(NEW.title, OLD.title), ''), 'Session');
  v_time_str := to_char(
    COALESCE(NEW.scheduled_at, OLD.scheduled_at) AT TIME ZONE 'Asia/Kolkata',
    'Mon DD, YYYY at HH12:MI AM'
  );

  -- ── INSERT: new session booked ──────────────────────────────
  IF TG_OP = 'INSERT' THEN

    -- Mentor: someone booked a session
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.mentor_id,
      'New Session Booked',
      v_mentee_name || ' booked "' || v_title || '" on ' || v_time_str,
      'session_booked'
    );

    -- Mentee: booking confirmation
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.mentee_id,
      'Session Confirmed',
      'Your session "' || v_title || '" with ' || v_mentor_name || ' is confirmed for ' || v_time_str,
      'session_booked'
    );

  -- ── UPDATE ──────────────────────────────────────────────────
  ELSIF TG_OP = 'UPDATE' THEN

    -- Status → cancelled
    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN

      -- Rescheduled (mentee booked a replacement slot)
      IF NEW.cancellation_reason = 'Rescheduled' THEN
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          NEW.mentor_id,
          'Session Rescheduled',
          v_mentee_name || ' rescheduled "' || v_title || '" that was set for ' || v_time_str || '. A new time has been booked.',
          'session_rescheduled'
        );

      -- Mentor cancelled → notify mentee
      ELSIF NEW.cancelled_by = NEW.mentor_id THEN
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          NEW.mentee_id,
          'Session Cancelled by Mentor',
          v_mentor_name || ' cancelled your session "' || v_title || '" scheduled for ' || v_time_str
            || CASE
                 WHEN NEW.cancellation_reason IS NOT NULL AND NEW.cancellation_reason <> ''
                 THEN '. Reason: ' || NEW.cancellation_reason
                 ELSE ''
               END,
          'session_cancelled_by_mentor'
        );

      -- Mentee cancelled → notify mentor
      ELSIF NEW.cancelled_by = NEW.mentee_id THEN
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          NEW.mentor_id,
          'Session Cancelled by Mentee',
          v_mentee_name || ' cancelled the session "' || v_title || '" scheduled for ' || v_time_str
            || CASE
                 WHEN NEW.cancellation_reason IS NOT NULL AND NEW.cancellation_reason <> ''
                 THEN '. Reason: ' || NEW.cancellation_reason
                 ELSE ''
               END,
          'session_cancelled_by_mentee'
        );
      END IF;

    -- Status → completed → notify mentee
    ELSIF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.mentee_id,
        'Session Completed',
        'Your session "' || v_title || '" with ' || v_mentor_name || ' has been marked as completed. Share your feedback!',
        'session_completed'
      );

    -- Still booked but meeting URL or notes updated → notify mentee
    ELSIF NEW.status = 'booked' AND OLD.status = 'booked' AND (
      (NEW.meeting_url IS DISTINCT FROM OLD.meeting_url AND NEW.meeting_url IS NOT NULL AND NEW.meeting_url <> '')
      OR (NEW.notes IS DISTINCT FROM OLD.notes)
    ) THEN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        NEW.mentee_id,
        'Session Details Updated',
        v_mentor_name || ' updated details for your session "' || v_title || '" on ' || v_time_str,
        'session_updated'
      );
    END IF;

  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_session ON public.sessions;
CREATE TRIGGER trg_notify_session
  AFTER INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_session_event();


-- ----------------------------------------------------------------
-- Helper: mentor application notification trigger
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_application_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_id UUID;
  v_admin        RECORD;
BEGIN
  -- Resolve applicant user_id from email (may be NULL if not yet registered)
  SELECT id INTO v_applicant_id
  FROM users
  WHERE email ILIKE NEW.email
  LIMIT 1;

  -- ── INSERT: new application ──────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    FOR v_admin IN SELECT id FROM users WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        v_admin.id,
        'New Mentor Application',
        NEW.full_name || ' submitted a mentor application and is awaiting review.',
        'application_submitted'
      );
    END LOOP;

  -- ── UPDATE: status transitions ───────────────────────────────
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN

    -- Resubmitted after changes were requested
    IF NEW.status = 'pending' AND OLD.status = 'changes_requested' THEN
      FOR v_admin IN SELECT id FROM users WHERE role = 'admin' LOOP
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          v_admin.id,
          'Application Resubmitted',
          NEW.full_name || ' resubmitted their mentor application after addressing the requested changes.',
          'application_resubmitted'
        );
      END LOOP;

    -- Approved
    ELSIF NEW.status = 'approved' THEN
      IF v_applicant_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          v_applicant_id,
          'Application Approved 🎉',
          'Congratulations! Your mentor application has been approved. You are now an active mentor on the platform.',
          'application_approved'
        );
      END IF;

    -- Rejected
    ELSIF NEW.status = 'rejected' THEN
      IF v_applicant_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          v_applicant_id,
          'Application Not Approved',
          'Unfortunately, your mentor application was not approved.'
            || CASE
                 WHEN NEW.rejection_reason IS NOT NULL AND NEW.rejection_reason <> ''
                 THEN ' Reason: ' || NEW.rejection_reason
                 ELSE ''
               END,
          'application_rejected'
        );
      END IF;

    -- Changes requested
    ELSIF NEW.status = 'changes_requested' THEN
      IF v_applicant_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (
          v_applicant_id,
          'Changes Requested on Your Application',
          'The admin has reviewed your mentor application and requested some changes.'
            || CASE
                 WHEN NEW.changes_feedback IS NOT NULL AND NEW.changes_feedback <> ''
                 THEN ' Feedback: ' || NEW.changes_feedback
                 ELSE ''
               END,
          'application_changes_requested'
        );
      END IF;
    END IF;

  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_application ON public.mentor_applications;
CREATE TRIGGER trg_notify_application
  AFTER INSERT OR UPDATE ON public.mentor_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_event();
