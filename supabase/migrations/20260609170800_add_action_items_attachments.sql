-- Add allow_mentee_attachments column to public.mentor_profiles
ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS allow_mentee_attachments BOOLEAN NOT NULL DEFAULT false;

-- Add mentor_attachments and mentee_attachments columns to public.session_action_items
ALTER TABLE public.session_action_items
  ADD COLUMN IF NOT EXISTS mentor_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mentee_attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Create session-attachments storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-attachments', 'session-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop policies on storage.objects if they exist
DROP POLICY IF EXISTS "Session attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload session attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete session attachments" ON storage.objects;

-- Create storage policies for session-attachments
CREATE POLICY "Session attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'session-attachments');

CREATE POLICY "Authenticated users can upload session attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'session-attachments');

CREATE POLICY "Authenticated users can delete session attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'session-attachments');
