-- Undo 20261001160000.
ALTER POLICY "Anyone can read active offerings" ON public.mentorship_offerings
  USING ((status = 'active'::text) OR (mentor_id = (SELECT auth.uid())) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER POLICY "Anyone can read active badges" ON public.badges
  USING ((is_active = true) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

ALTER TABLE public.mentorship_offerings DROP CONSTRAINT mentorship_offerings_mentor_id_fkey;
ALTER TABLE public.mentorship_offerings
  ADD CONSTRAINT mentorship_offerings_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
