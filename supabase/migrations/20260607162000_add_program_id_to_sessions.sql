-- Add program_id to public.sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;
