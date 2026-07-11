-- Add changes_requested to application_status enum
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- Add columns to mentor_applications
ALTER TABLE public.mentor_applications
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS changes_feedback TEXT;

-- Add rejection_cooldown_days to branding
ALTER TABLE public.branding
ADD COLUMN IF NOT EXISTS rejection_cooldown_days INTEGER NOT NULL DEFAULT 30;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications"
ON public.notifications
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index on user_id and read status for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
