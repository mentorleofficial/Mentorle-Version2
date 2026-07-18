-- Six auth-only accounts (backfilled into public.users on 2026-07-17) have no
-- mentee_profiles row, so the admin detail view renders nothing for them. Give every
-- mentee-role user an empty profile row; their first login still routes through the
-- onboarding wizard because onboarded_at stays NULL.
INSERT INTO public.mentee_profiles (user_id)
SELECT u.id
FROM public.users u
LEFT JOIN public.mentee_profiles mp ON mp.user_id = u.id
WHERE u.role = 'mentee' AND mp.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
