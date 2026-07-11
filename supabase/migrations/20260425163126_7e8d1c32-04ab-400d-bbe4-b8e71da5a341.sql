-- 1. Add timezone to mentor_profiles
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- 2. Create overrides table
CREATE TABLE IF NOT EXISTS public.mentor_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  date date NOT NULL,
  is_unavailable boolean NOT NULL DEFAULT false,
  start_time time NULL,
  end_time time NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentor_availability_overrides_mentor_date_idx
  ON public.mentor_availability_overrides (mentor_id, date);

ALTER TABLE public.mentor_availability_overrides ENABLE ROW LEVEL SECURITY;

-- Policies (mirror mentor_availability)
CREATE POLICY "Mentors manage own overrides"
  ON public.mentor_availability_overrides
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "Authenticated users read overrides"
  ON public.mentor_availability_overrides
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins full access on mentor_availability_overrides"
  ON public.mentor_availability_overrides
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
