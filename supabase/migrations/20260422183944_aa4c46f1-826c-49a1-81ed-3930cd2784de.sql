ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS headline text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS phone text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS current_organization text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS "current_role" text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS portfolio_url text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS resume_url text DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS experiences jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatars are publicly readable') THEN
    CREATE POLICY "Avatars are publicly readable" ON storage.objects FOR SELECT
      USING (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users upload their own avatar') THEN
    CREATE POLICY "Users upload their own avatar" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users update their own avatar') THEN
    CREATE POLICY "Users update their own avatar" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users delete their own avatar') THEN
    CREATE POLICY "Users delete their own avatar" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'branding-assets' AND (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text);
  END IF;
END $$;