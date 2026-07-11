CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_created_at_desc ON public.users (created_at DESC);
