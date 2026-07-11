ALTER TABLE public.mentor_profiles ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';
UPDATE public.mentor_profiles SET timezone = 'Asia/Kolkata' WHERE timezone IS DISTINCT FROM 'Asia/Kolkata';