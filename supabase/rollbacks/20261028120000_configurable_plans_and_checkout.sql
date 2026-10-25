-- Rollback for 20261028120000_configurable_plans_and_checkout.sql: the previous quota / plan functions (as they
-- were in production on 2026-10-24), no new checkout functions, legacy Plus plans selling again. Membership
-- payments made in between stay in payments (the kind check is left allowing them).

DROP FUNCTION IF EXISTS public.book_plus_session(uuid, timestamptz, text, uuid);
DROP FUNCTION IF EXISTS public.prepare_paid_session(uuid, uuid, timestamptz);
DROP FUNCTION IF EXISTS public.complete_paid_session(uuid);
DROP FUNCTION IF EXISTS public.complete_paid_event(uuid);
DROP FUNCTION IF EXISTS public.activate_membership(uuid);
DROP FUNCTION IF EXISTS public.notify_admins(text, text, text);
DROP FUNCTION IF EXISTS public.plus_quota_status();

CREATE OR REPLACE FUNCTION public.plus_quota_status()
 RETURNS TABLE(has_membership boolean, quota_total integer, quota_used integer, quota_remaining integer, discount_percent numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _m         public.memberships%ROWTYPE;
  _quota     integer;
  _win_start date;
  _used      integer;
  _discount  numeric;
BEGIN
  SELECT plus_discount_percent INTO _discount FROM public.payment_settings LIMIT 1;
  _discount := COALESCE(_discount, 0);

  SELECT * INTO _m FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;
  IF _m.id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, _discount;
    RETURN;
  END IF;

  SELECT monthly_quota INTO _quota FROM public.subscription_plans WHERE id = _m.plan_id;
  _quota := COALESCE(_quota, 2);
  _win_start := public.plus_quota_window_start(
    COALESCE(_m.quota_anchor_day, EXTRACT(DAY FROM COALESCE(_m.started_at, now()))::int),
    current_date
  );
  SELECT count(*) INTO _used FROM public.plus_session_usage
    WHERE membership_id = _m.id AND quota_period_start = _win_start;

  RETURN QUERY SELECT true, _quota, _used, GREATEST(_quota - _used, 0), _discount;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.plus_quota_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_plus_session(_user_id uuid, _kind text, _mentor_id uuid, _reference_id uuid, _list_price numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _m         public.memberships%ROWTYPE;
  _quota     int;
  _win_start date;
  _win_end   date;
  _used      int;
  _percent   numeric;
  _accrued   numeric;
  _usage_id  uuid;
BEGIN
  SELECT * INTO _m FROM public.memberships
    WHERE user_id = _user_id AND status = 'active'
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;
  IF _m.id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_MEMBERSHIP';
  END IF;

  SELECT monthly_quota INTO _quota FROM public.subscription_plans WHERE id = _m.plan_id;
  _quota := COALESCE(_quota, 2);

  _win_start := public.plus_quota_window_start(
    COALESCE(_m.quota_anchor_day, EXTRACT(DAY FROM COALESCE(_m.started_at, now()))::int),
    current_date
  );
  _win_end := (_win_start + interval '1 month')::date;

  SELECT count(*) INTO _used FROM public.plus_session_usage
    WHERE membership_id = _m.id AND quota_period_start = _win_start;
  IF _used >= _quota THEN
    RAISE EXCEPTION 'QUOTA_EXHAUSTED';
  END IF;

  SELECT plus_payout_percent INTO _percent FROM public.payment_settings LIMIT 1;
  _accrued := round(COALESCE(_list_price, 0) * COALESCE(_percent, 0) / 100, 2);

  INSERT INTO public.plus_session_usage(
    membership_id, user_id, kind, reference_id, mentor_id, list_price, accrued_amount,
    quota_period_start, quota_period_end)
  VALUES (_m.id, _user_id, _kind, _reference_id, _mentor_id, COALESCE(_list_price, 0), _accrued,
    _win_start, _win_end)
  RETURNING id INTO _usage_id;

  INSERT INTO public.mentor_earnings(mentor_id, source, reference_id, gross_amount, fee_amount, net_amount)
  VALUES (_mentor_id,
    CASE WHEN _kind = 'event' THEN 'plus_event' ELSE 'plus_session' END,
    _reference_id, COALESCE(_list_price, 0),
    GREATEST(COALESCE(_list_price, 0) - _accrued, 0), _accrued);

  RETURN _usage_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.consume_plus_session(uuid, text, uuid, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_active_plans()
 RETURNS SETOF subscription_plans
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.subscription_plans WHERE is_active ORDER BY price
$function$;

DROP FUNCTION IF EXISTS public.plus_quota_window(text, timestamptz, integer, date);
DROP FUNCTION IF EXISTS public.active_membership(uuid);

UPDATE public.subscription_plans SET is_active = true WHERE slug IN ('plus-monthly', 'plus-yearly');
DELETE FROM public.subscription_plans p WHERE p.billing IN ('free', 'one_time') AND NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.plan_id = p.id);
UPDATE public.subscription_plans SET is_active = false WHERE billing IN ('free', 'one_time');
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_config_check;
ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS billing, DROP COLUMN IF EXISTS access_months, DROP COLUMN IF EXISTS session_discount_percent,
  DROP COLUMN IF EXISTS event_discount_percent, DROP COLUMN IF EXISTS free_sessions, DROP COLUMN IF EXISTS free_sessions_period,
  DROP COLUMN IF EXISTS tagline, DROP COLUMN IF EXISTS intro, DROP COLUMN IF EXISTS badge, DROP COLUMN IF EXISTS featured,
  DROP COLUMN IF EXISTS cta_label, DROP COLUMN IF EXISTS price_note, DROP COLUMN IF EXISTS sort_order;

DROP FUNCTION IF EXISTS public.list_public_offerings();
CREATE FUNCTION public.list_public_offerings()
RETURNS TABLE (id uuid, title text, description text, duration_minutes integer, price numeric, category text, status text, mentor_id uuid, mentor_full_name text, mentor_avatar_url text, mentor_current_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.description, o.duration_minutes, o.price, o.category, o.status, o.mentor_id, u.full_name, u.avatar_url, mp."current_role"
  FROM public.mentorship_offerings o
  JOIN public.users u ON u.id = o.mentor_id
  LEFT JOIN public.mentor_profiles mp ON mp.user_id = o.mentor_id
  WHERE o.status = 'active' AND COALESCE(u.is_disabled, false) = false AND COALESCE(mp.is_active, true) = true
  ORDER BY o.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.list_public_offerings() TO anon, authenticated;
