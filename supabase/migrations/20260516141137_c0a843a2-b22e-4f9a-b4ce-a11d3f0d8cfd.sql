
-- Branding additions
ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS edubridge_webhook_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS edubridge_enabled boolean NOT NULL DEFAULT false;

-- Outbound events queue
DO $$ BEGIN
  CREATE TYPE public.outbound_event_status AS ENUM ('pending','sent','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.outbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_url text NOT NULL DEFAULT '',
  status public.outbound_event_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text NOT NULL DEFAULT '',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outbound_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage outbound_events" ON public.outbound_events;
CREATE POLICY "Admins manage outbound_events"
  ON public.outbound_events
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_outbound_events_updated_at ON public.outbound_events;
CREATE TRIGGER trg_outbound_events_updated_at
  BEFORE UPDATE ON public.outbound_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_outbound_events_status ON public.outbound_events(status, created_at);
