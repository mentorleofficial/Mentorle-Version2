-- Create mentorship_offerings table
CREATE TABLE IF NOT EXISTS public.mentorship_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'mentorship',
  price decimal(10, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mentorship_offerings ENABLE ROW LEVEL SECURITY;

-- Policies for mentorship_offerings
CREATE POLICY "Anyone can read active offerings"
  ON public.mentorship_offerings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR mentor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentors manage own offerings"
  ON public.mentorship_offerings
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (mentor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Add offering_id to public.sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.mentorship_offerings(id) ON DELETE SET NULL;

-- Add settings to public.mentor_profiles
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS buffer_time_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_notice_hours integer NOT NULL DEFAULT 0;
