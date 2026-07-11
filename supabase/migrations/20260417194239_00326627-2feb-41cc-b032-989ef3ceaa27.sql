-- Enum for application status
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

-- Mentor applications table
CREATE TABLE public.mentor_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  bio TEXT NOT NULL,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  years_experience INTEGER NOT NULL DEFAULT 0,
  resume_url TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit application"
ON public.mentor_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins read applications"
ON public.mentor_applications FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update applications"
ON public.mentor_applications FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete applications"
ON public.mentor_applications FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER mentor_applications_updated_at
BEFORE UPDATE ON public.mentor_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_mentor_applications_status ON public.mentor_applications(status);
CREATE INDEX idx_mentor_applications_created_at ON public.mentor_applications(created_at DESC);

-- Add is_active to mentor_profiles
ALTER TABLE public.mentor_profiles
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false;

-- Storage bucket for resumes (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentor-resumes', 'mentor-resumes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload resume"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'mentor-resumes');

CREATE POLICY "Admins read resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mentor-resumes' AND public.has_role(auth.uid(), 'admin'));