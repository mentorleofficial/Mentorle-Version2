-- Logged-out visitors could not load a mentor's offerings or badges on the public profile:
-- these anon-facing policies also called has_role(), which anon may not execute
-- (deliberately revoked in 20260516151559), so the whole query failed with 42501.
-- The owner/admin branches are already covered by the "Mentors manage own offerings" and
-- "Admins manage badges" ALL policies, so dropping them here changes nothing for
-- logged-in users.
ALTER POLICY "Anyone can read active offerings" ON public.mentorship_offerings
  USING (status = 'active'::text);

ALTER POLICY "Anyone can read active badges" ON public.badges
  USING (is_active = true);

-- The admin Offerings page embeds users via this FK, but it pointed at auth.users, which
-- PostgREST cannot embed as public.users, so the page failed with 400. public.users.id
-- itself cascades from auth.users, so deleting an account still removes its offerings.
ALTER TABLE public.mentorship_offerings DROP CONSTRAINT mentorship_offerings_mentor_id_fkey;
ALTER TABLE public.mentorship_offerings
  ADD CONSTRAINT mentorship_offerings_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE CASCADE;
