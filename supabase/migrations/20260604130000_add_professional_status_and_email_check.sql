-- Add professional_status and conditional organization fields to mentor_applications
ALTER TABLE public.mentor_applications
  ADD COLUMN IF NOT EXISTS professional_status TEXT,
  ADD COLUMN IF NOT EXISTS current_organization TEXT,
  ADD COLUMN IF NOT EXISTS "current_role" TEXT;

-- Add professional_status to mentor_profiles
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS professional_status TEXT;

-- Create function to check if email exists in public.users
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE LOWER(email) = LOWER(email_to_check)
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon, authenticated;
