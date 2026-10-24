-- Undo 20261023121000.
ALTER POLICY "Mentors can manage own events" ON public.events_programs
  USING (((created_by = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))))
  WITH CHECK (((created_by = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));

ALTER POLICY "Mentors manage own offerings" ON public.mentorship_offerings
  USING (((mentor_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))))
  WITH CHECK (((mentor_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))));
