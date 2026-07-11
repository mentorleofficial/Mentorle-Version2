
-- 1. Privacy policy versioning
CREATE TABLE public.privacy_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  url text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  effective_from timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read privacy policy"
  ON public.privacy_policy FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Admins manage privacy policy"
  ON public.privacy_policy FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only one current policy
CREATE UNIQUE INDEX privacy_policy_one_current
  ON public.privacy_policy ((is_current)) WHERE is_current = true;

CREATE TRIGGER privacy_policy_updated_at
  BEFORE UPDATE ON public.privacy_policy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER privacy_policy_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.privacy_policy
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. User consents (acceptance log, never hard-deleted)
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_consents_user ON public.user_consents(user_id, accepted_at DESC);

CREATE POLICY "Users read own consents"
  ON public.user_consents FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users insert own consents"
  ON public.user_consents FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users withdraw own consent"
  ON public.user_consents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read consents"
  ON public.user_consents FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER user_consents_audit
  AFTER INSERT OR UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 3. Data subject requests (export / correction / deletion / withdrawal)
DO $$ BEGIN
  CREATE TYPE public.dsr_kind AS ENUM ('export', 'correction', 'deletion', 'withdrawal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dsr_status AS ENUM ('pending', 'in_review', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.dsr_kind NOT NULL,
  status public.dsr_status NOT NULL DEFAULT 'pending',
  message text NOT NULL DEFAULT '',
  admin_notes text NOT NULL DEFAULT '',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_dsr_user ON public.data_subject_requests(user_id, created_at DESC);
CREATE INDEX idx_dsr_status ON public.data_subject_requests(status, created_at DESC);

CREATE POLICY "Users read own DSRs"
  ON public.data_subject_requests FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create own DSRs"
  ON public.data_subject_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins full access on DSRs"
  ON public.data_subject_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER dsr_updated_at
  BEFORE UPDATE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER dsr_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. Data retention settings (singleton)
CREATE TABLE public.data_retention_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessions_retention_days integer NOT NULL DEFAULT 1095,        -- 3 years
  audit_logs_retention_days integer NOT NULL DEFAULT 730,       -- 2 years
  inactive_user_retention_days integer NOT NULL DEFAULT 1095,   -- 3 years
  last_sweep_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read retention settings"
  ON public.data_retention_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage retention settings"
  ON public.data_retention_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER retention_settings_updated_at
  BEFORE UPDATE ON public.data_retention_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER retention_settings_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.data_retention_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Seed a default retention row and a default policy version
INSERT INTO public.data_retention_settings DEFAULT VALUES;

INSERT INTO public.privacy_policy (version, url, summary, is_current)
VALUES ('1.0', '', 'Initial privacy policy. Update from Admin → Settings.', true);
