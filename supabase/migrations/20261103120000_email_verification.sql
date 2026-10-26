-- Verified email for partner features (Huptle one-click apply sends the mentee's email to Huptle as verified).
--
-- Normal signups confirm their email with the 8-digit code, so they're verified. Event-mode quick signups skip the
-- code (their accounts are created already confirmed), so they count as unverified until they prove the address:
-- mentorle.in emails them a code (Supabase email OTP), they enter it, and mark_email_verified() records it. It only
-- succeeds right after a code sign-in, which the session's own token proves (its "amr" claim), so nobody can mark an
-- address they don't control.

CREATE TABLE IF NOT EXISTS public.email_verifications (
  user_id     uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_verifications FROM anon, authenticated;

-- Is the signed-in user's email verified?
CREATE OR REPLACE FUNCTION public.my_email_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.email_verifications v JOIN public.users u ON u.id = v.user_id
             WHERE v.user_id = auth.uid() AND lower(v.email) = lower(u.email))
    OR NOT EXISTS (SELECT 1 FROM public.event_entries WHERE user_id = auth.uid() AND quick_signup)
  )
$$;

-- Record that the signed-in user just proved their email with a code.
CREATE OR REPLACE FUNCTION public.mark_email_verified()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent boolean;
  addr text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  -- The session must come from an email code sign-in in the last 15 minutes.
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
     WHERE a ->> 'method' = 'otp' AND (a ->> 'timestamp')::bigint > extract(epoch FROM now() - interval '15 minutes')
  ) INTO recent;
  IF NOT recent THEN
    RAISE EXCEPTION 'Verify your email with the code first' USING ERRCODE = '42501';
  END IF;
  SELECT email INTO addr FROM public.users WHERE id = auth.uid();
  INSERT INTO public.email_verifications (user_id, email) VALUES (auth.uid(), addr)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, verified_at = now();
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_email_verified(), public.mark_email_verified() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_email_verified(), public.mark_email_verified() TO authenticated;

NOTIFY pgrst, 'reload schema';
