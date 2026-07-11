-- Extend jwt_config with SSO fields
ALTER TABLE public.jwt_config
  ADD COLUMN IF NOT EXISTS jwks_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS login_redirect_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logout_redirect_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS token_param_name text DEFAULT 'token',
  ADD COLUMN IF NOT EXISTS claim_email text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS claim_full_name text DEFAULT 'name',
  ADD COLUMN IF NOT EXISTS claim_user_id text DEFAULT 'sub',
  ADD COLUMN IF NOT EXISTS claim_role text DEFAULT 'role',
  ADD COLUMN IF NOT EXISTS default_role public.app_role DEFAULT 'mentee'::public.app_role,
  ADD COLUMN IF NOT EXISTS auto_provision boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_clock_skew_seconds integer DEFAULT 30;

-- Create branding-assets storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for branding-assets
DROP POLICY IF EXISTS "Branding assets public read" ON storage.objects;
CREATE POLICY "Branding assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding-assets');

DROP POLICY IF EXISTS "Admins upload branding assets" ON storage.objects;
CREATE POLICY "Admins upload branding assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'branding-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update branding assets" ON storage.objects;
CREATE POLICY "Admins update branding assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'branding-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete branding assets" ON storage.objects;
CREATE POLICY "Admins delete branding assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'branding-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));