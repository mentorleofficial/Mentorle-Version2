-- ILIKE treats "_" and "%" in an email as wildcards, so an applicant named john_doe@x.com
-- also matched john.doe@x.com and the wrong user could be notified. Match exactly instead.
CREATE OR REPLACE FUNCTION public.notify_application_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_applicant_id UUID;
  v_admin        RECORD;
BEGIN
  -- Resolve applicant user_id from email (may be NULL if not yet registered)
  SELECT id INTO v_applicant_id
  FROM users
  WHERE lower(email) = lower(NEW.email)
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
$function$;

-- Logged-out visitors could read every column of active mentors' rows through the REST API,
-- including users.email and mentor_profiles.phone. Public pages read mentors through
-- SECURITY DEFINER RPCs (list_public_mentors, get_public_mentor), so anon only needs the
-- columns the RLS policies reference. Logged-in access is unchanged.
REVOKE SELECT ON public.users FROM anon;
GRANT SELECT (id, full_name, avatar_url) ON public.users TO anon;

REVOKE SELECT ON public.mentor_profiles FROM anon;
GRANT SELECT (id, user_id, bio, expertise, years_experience, linkedin_url, created_at, updated_at,
  is_active, headline, current_organization, "current_role", portfolio_url, qualifications,
  experiences, approval_acknowledged_at, slug, timezone, professional_status, buffer_time_minutes,
  minimum_notice_hours, allow_mentee_attachments, company_url, designation)
  ON public.mentor_profiles TO anon;
