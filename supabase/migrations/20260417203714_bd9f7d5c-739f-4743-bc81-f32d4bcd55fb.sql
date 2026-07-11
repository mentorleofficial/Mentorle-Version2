-- 1. Update handle_new_user: fallback to email prefix, never use role as name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_name text;
  resolved_name text;
BEGIN
  meta_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');

  -- Never accept a role word as a name
  IF meta_name IS NOT NULL AND lower(meta_name) IN ('admin','mentor','mentee') THEN
    meta_name := NULL;
  END IF;

  resolved_name := COALESCE(meta_name, split_part(NEW.email, '@', 1));

  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    resolved_name,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'mentee')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'mentee')
  );
  RETURN NEW;
END;
$function$;

-- 2. One-time data repair for existing rows where full_name is a role word or empty
UPDATE public.users u
SET full_name = COALESCE(
  NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
  split_part(u.email, '@', 1)
)
FROM auth.users au
WHERE au.id = u.id
  AND (
    u.full_name IS NULL
    OR TRIM(u.full_name) = ''
    OR lower(u.full_name) IN ('admin','mentor','mentee')
  )
  AND lower(COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''), '')) NOT IN ('admin','mentor','mentee');