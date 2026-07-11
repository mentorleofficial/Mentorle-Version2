-- Test Script for Action Item Notification Trigger

-- 1. Create mentor in auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'mentor@example.com',
  '{"full_name": "Test Mentor", "role": "mentor"}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create mentee in auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'mentee@example.com',
  '{"full_name": "Test Mentee", "role": "mentee"}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 3. Ensure role matches in public.users
UPDATE public.users SET role = 'mentor' WHERE email = 'mentor@example.com';
UPDATE public.users SET role = 'mentee' WHERE email = 'mentee@example.com';

-- 4. Create a completed session
INSERT INTO public.sessions (id, mentor_id, mentee_id, scheduled_at, status, title)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  now(),
  'completed',
  'Goal Setting Session'
) ON CONFLICT (id) DO NOTHING;

-- 5. Insert an action item assigned by the mentor (created_by = mentor_id)
INSERT INTO public.session_action_items (id, session_id, mentor_id, mentee_id, title, description, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Read the new Privacy Policy',
  'Check the H1 and H2 formatting in the privacy policy document.',
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- 6. Query the notifications table to verify the trigger worked
SELECT user_id, title, message, type FROM public.notifications;
