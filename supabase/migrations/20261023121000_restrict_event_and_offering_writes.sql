-- Security: any signed-in account could publish public events and offerings.
--
-- "Mentors can manage own events" and "Mentors manage own offerings" only checked ownership
-- (created_by / mentor_id = auth.uid()), not the role, so a mentee account could insert rows into
-- events_programs (readable by anyone) and mentorship_offerings (active ones readable by anyone) and have
-- them appear on the public site. Writes now also require the mentor role; admins keep full access.

ALTER POLICY "Mentors can manage own events" ON public.events_programs
  USING (
    ((created_by = (SELECT auth.uid())) AND (SELECT public.has_role((SELECT auth.uid()), 'mentor'::public.app_role)))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  )
  WITH CHECK (
    ((created_by = (SELECT auth.uid())) AND (SELECT public.has_role((SELECT auth.uid()), 'mentor'::public.app_role)))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

ALTER POLICY "Mentors manage own offerings" ON public.mentorship_offerings
  USING (
    ((mentor_id = (SELECT auth.uid())) AND (SELECT public.has_role((SELECT auth.uid()), 'mentor'::public.app_role)))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  )
  WITH CHECK (
    ((mentor_id = (SELECT auth.uid())) AND (SELECT public.has_role((SELECT auth.uid()), 'mentor'::public.app_role)))
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );
