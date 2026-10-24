-- Configurable plans (admin panel), one-time yearly passes, and secure paid / free-session booking.
--
-- Plans
--   subscription_plans gains everything a plan needs to be configured from the admin panel and shown on
--   mentorle.in's pricing page: billing ('free' display tier, 'one_time' pass, or the legacy 'subscription'),
--   access_months, session / event discount %, free sessions per month or year, and card copy (tagline, intro,
--   badge, featured, CTA label, note, order). Benefits stay a list of strings ("**Bold** rest" marks the lead).
--   The two legacy Plus subscription plans stop selling (their 2 active members keep them); Free Community and
--   Pro Pass (₹4,999 / year, 15% off 1:1 sessions) are added.
--
-- Memberships
--   active_membership() is the one definition of "this user's current plan". One-time passes are memberships
--   with cancel_at_period_end, so the hourly expire-cancelled-memberships job ends them. activate_membership()
--   starts or extends one when its payment succeeds.
--
-- Free sessions and discounts
--   plus_quota_status() / consume_plus_session() read the plan's free_sessions per month or per membership
--   year (was a fixed monthly_quota) and the plan's own discounts (was one global percent).
--   book_plus_session() books a free session like book_session() (open slot, onboarded mentee, eligible
--   offering) and uses one in the same transaction. consume_plus_session() is no longer callable by users.
--
-- Paid checkout (called by the cashfree-* edge functions with the service role, never by users)
--   prepare_paid_session()   validates a paid booking (mentee, offering, open slot) and returns its price.
--   complete_paid_session()  creates the session after payment (offering's length and title, the mentor's
--                            link or Jitsi), records the mentor's earning; if the slot was taken meanwhile it
--                            flags the payment for a refund and tells the admins instead.
--   complete_paid_event(), activate_membership()  the same for events and passes. All are idempotent.
--
-- Rollback: supabase/rollbacks/20261028120000_configurable_plans_and_checkout.sql

-- --- Plans ------------------------------------------------------------------------------------------------------

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS billing text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS access_months integer,
  ADD COLUMN IF NOT EXISTS session_discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS event_discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_sessions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_sessions_period text NOT NULL DEFAULT 'year',
  ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS intro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS badge text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Legacy subscription plans: their quota and the old global discount move onto the plan, then they stop selling.
UPDATE public.subscription_plans p
   SET billing = 'subscription',
       free_sessions = p.monthly_quota,
       free_sessions_period = 'month',
       session_discount_percent = coalesce((SELECT plus_discount_percent FROM public.payment_settings LIMIT 1), 0),
       event_discount_percent = coalesce((SELECT plus_discount_percent FROM public.payment_settings LIMIT 1), 0),
       is_active = false,
       sort_order = 100
 WHERE p.slug IN ('plus-monthly', 'plus-yearly');

ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_config_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_config_check CHECK (
    billing IN ('free', 'one_time', 'subscription')
    AND free_sessions_period IN ('month', 'year')
    AND session_discount_percent BETWEEN 0 AND 100
    AND event_discount_percent BETWEEN 0 AND 100
    AND free_sessions BETWEEN 0 AND 100
    AND (billing <> 'free' OR price = 0)
    AND (billing <> 'one_time' OR (price > 0 AND access_months BETWEEN 1 AND 60))
    AND length(btrim(name)) > 0
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

INSERT INTO public.subscription_plans (name, slug, interval, price, monthly_quota, benefits, is_active, billing, access_months,
  session_discount_percent, event_discount_percent, free_sessions, free_sessions_period, tagline, intro, badge, featured, cta_label, sort_order)
VALUES
  ('Free Community', 'free-community', 'year', 0, 0,
   '["Join community learning sessions and discussions", "Discover relevant jobs, internships, events, and hackathons", "Connect with fellow students, builders, and professionals", "Explore learning resources and community opportunities"]'::jsonb,
   true, 'free', NULL, 0, 0, 0, 'year',
   'Your starting point for learning, connections, and opportunities.', '', '', false, 'Join the Free Community', 0),
  ('Pro Pass', 'pro-pass', 'year', 4999, 0,
   '["**12 expert-led group masterclasses per year** to build practical knowledge", "**Structured career and skill-development guidance** to help you identify your next steps", "**Access to member resources and learning materials**, where available", "**Discounts on eligible 1:1 mentorship sessions**", "**Priority access to selected community events and networking opportunities**", "**Relevant opportunity and profile-sharing support** when suitable opportunities are available"]'::jsonb,
   true, 'one_time', 12, 15, 0, 0, 'year',
   'For people ready to invest in their growth with more structure and support.', 'Everything in Free, plus:', 'Most Popular', true, 'Get Pro Pass', 1)
ON CONFLICT (slug) DO NOTHING;

-- Public: the pricing page reads plans before anyone signs in.
CREATE OR REPLACE FUNCTION public.list_active_plans()
RETURNS SETOF public.subscription_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.subscription_plans WHERE is_active ORDER BY sort_order, price
$$;
REVOKE EXECUTE ON FUNCTION public.list_active_plans() FROM public;
GRANT EXECUTE ON FUNCTION public.list_active_plans() TO anon, authenticated;

-- --- Payments ---------------------------------------------------------------------------------------------------

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_kind_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_kind_check CHECK (kind = ANY (ARRAY['session', 'event', 'addon', 'subscription', 'membership']));

-- --- Current membership ------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.active_membership(_user_id uuid)
RETURNS TABLE (
  membership_id uuid, plan_id uuid, plan_name text, plan_slug text, started_at timestamptz, period_end timestamptz,
  session_discount numeric, event_discount numeric, free_sessions integer, free_period text, anchor_day integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, p.id, coalesce(p.name, 'Mentorle Plus'), coalesce(p.slug, ''),
         coalesce(m.started_at, m.current_period_start, m.created_at), m.current_period_end,
         coalesce(p.session_discount_percent, 0), coalesce(p.event_discount_percent, 0),
         coalesce(p.free_sessions, 0), coalesce(p.free_sessions_period, 'month'), m.quota_anchor_day
  FROM public.memberships m
  LEFT JOIN public.subscription_plans p ON p.id = m.plan_id
  WHERE m.user_id = _user_id AND m.status = 'active'
    AND (NOT m.cancel_at_period_end OR m.current_period_end IS NULL OR m.current_period_end > now())
  ORDER BY m.current_period_end DESC NULLS LAST
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.active_membership(uuid) FROM public, anon, authenticated;

-- The current free-session window: a calendar month from the anchor day, or a membership year.
CREATE OR REPLACE FUNCTION public.plus_quota_window(_period text, _started timestamptz, _anchor integer, _today date)
RETURNS TABLE (win_start date, win_end date)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  first_day date := (coalesce(_started, now()) AT TIME ZONE 'Asia/Kolkata')::date;
  years integer;
BEGIN
  IF _period = 'year' THEN
    years := greatest(0, extract(year FROM age(_today, first_day))::integer);
    win_start := (first_day + make_interval(years => years))::date;
    win_end := (win_start + interval '1 year')::date;
  ELSE
    win_start := public.plus_quota_window_start(coalesce(_anchor, extract(day FROM first_day)::integer), _today);
    win_end := (win_start + interval '1 month')::date;
  END IF;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.plus_quota_status();
CREATE FUNCTION public.plus_quota_status()
RETURNS TABLE (
  has_membership boolean, quota_total integer, quota_used integer, quota_remaining integer, discount_percent numeric,
  event_discount_percent numeric, plan_name text, plan_slug text, period_end timestamptz, quota_period text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  w record;
  used integer;
BEGIN
  SELECT * INTO m FROM public.active_membership(auth.uid());
  IF m.membership_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0::numeric, 0::numeric, NULL::text, NULL::text, NULL::timestamptz, NULL::text;
    RETURN;
  END IF;
  SELECT * INTO w FROM public.plus_quota_window(m.free_period, m.started_at, m.anchor_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  SELECT count(*) INTO used FROM public.plus_session_usage WHERE membership_id = m.membership_id AND quota_period_start = w.win_start;
  RETURN QUERY SELECT true, m.free_sessions, used, greatest(m.free_sessions - used, 0), m.session_discount, m.event_discount,
                      m.plan_name, m.plan_slug, m.period_end, m.free_period;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.plus_quota_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.plus_quota_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_plus_session(_user_id uuid, _kind text, _mentor_id uuid, _reference_id uuid, _list_price numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  w record;
  used integer;
  payout numeric;
  accrued numeric;
  usage_id uuid;
BEGIN
  SELECT * INTO m FROM public.active_membership(_user_id);
  IF m.membership_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_MEMBERSHIP';
  END IF;
  PERFORM 1 FROM public.memberships WHERE id = m.membership_id FOR UPDATE;
  SELECT * INTO w FROM public.plus_quota_window(m.free_period, m.started_at, m.anchor_day, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  SELECT count(*) INTO used FROM public.plus_session_usage WHERE membership_id = m.membership_id AND quota_period_start = w.win_start;
  IF used >= m.free_sessions THEN
    RAISE EXCEPTION 'QUOTA_EXHAUSTED';
  END IF;

  SELECT plus_payout_percent INTO payout FROM public.payment_settings LIMIT 1;
  accrued := round(coalesce(_list_price, 0) * coalesce(payout, 0) / 100, 2);

  INSERT INTO public.plus_session_usage (membership_id, user_id, kind, reference_id, mentor_id, list_price, accrued_amount, quota_period_start, quota_period_end)
  VALUES (m.membership_id, _user_id, _kind, _reference_id, _mentor_id, coalesce(_list_price, 0), accrued, w.win_start, w.win_end)
  RETURNING id INTO usage_id;

  INSERT INTO public.mentor_earnings (mentor_id, source, reference_id, gross_amount, fee_amount, net_amount)
  VALUES (_mentor_id, CASE WHEN _kind = 'event' THEN 'plus_event' ELSE 'plus_session' END, _reference_id,
          coalesce(_list_price, 0), greatest(coalesce(_list_price, 0) - accrued, 0), accrued);
  RETURN usage_id;
END;
$$;
-- Only the booking functions and the platform's book-plus-session (service role) use a free session.
REVOKE EXECUTE ON FUNCTION public.consume_plus_session(uuid, text, uuid, uuid, numeric) FROM public, anon, authenticated;

-- --- Free sessions: book like book_session() ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.book_plus_session(_offering_id uuid, _scheduled_at timestamptz, _notes text DEFAULT '', _program_id uuid DEFAULT NULL)
RETURNS TABLE (session_id uuid, meeting_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  o record;
  link text;
  program uuid := NULL;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Log in to book a session' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(uid, 'mentee'::public.app_role) THEN
    RAISE EXCEPTION 'Only mentee accounts can book sessions' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mentee_profiles WHERE user_id = uid AND onboarded_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Finish your profile before booking' USING ERRCODE = 'P0001';
  END IF;

  SELECT off.id, off.mentor_id, off.title, off.price, off.duration_minutes, off.plus_eligible, mp.default_meeting_url
    INTO o
  FROM public.mentorship_offerings off
  JOIN public.mentor_profiles mp ON mp.user_id = off.mentor_id
  JOIN public.users u ON u.id = off.mentor_id
  WHERE off.id = _offering_id AND off.status = 'active' AND mp.is_active AND NOT u.is_disabled;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'This session isn''t available to book' USING ERRCODE = 'P0001';
  END IF;
  IF o.mentor_id = uid THEN
    RAISE EXCEPTION 'You can''t book your own session' USING ERRCODE = 'P0001';
  END IF;
  IF NOT coalesce(o.plus_eligible, false) OR coalesce(o.price, 0) <= 0 THEN
    RAISE EXCEPTION 'This session can''t be booked with a free session' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(o.mentor_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.mentor_open_slots(o.id, (_scheduled_at AT TIME ZONE 'Asia/Kolkata')::date, 1, NULL) s WHERE s.starts_at = _scheduled_at
  ) THEN
    RAISE EXCEPTION 'That time is no longer available. Please pick another.' USING ERRCODE = '23P01';
  END IF;

  IF _program_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.program_mentors WHERE program_id = _program_id AND mentor_id = o.mentor_id)
     AND EXISTS (SELECT 1 FROM public.program_mentees WHERE program_id = _program_id AND mentee_id = uid) THEN
    program := _program_id;
  END IF;

  link := coalesce(nullif(btrim(o.default_meeting_url), ''), 'https://meet.jit.si/mentorle-' || gen_random_uuid());
  INSERT INTO public.sessions (mentor_id, mentee_id, scheduled_at, duration_minutes, status, title, topic, mentee_notes, meeting_url, offering_id, program_id)
  VALUES (o.mentor_id, uid, _scheduled_at, o.duration_minutes, 'booked', coalesce(nullif(o.title, ''), 'Mentorship session'), '',
          left(btrim(coalesce(_notes, '')), 2000), link, o.id, program)
  RETURNING id INTO new_id;

  -- Raises QUOTA_EXHAUSTED / NO_ACTIVE_MEMBERSHIP, which undoes the session too.
  PERFORM public.consume_plus_session(uid, 'session', o.mentor_id, new_id, o.price);
  RETURN QUERY SELECT new_id, link;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.book_plus_session(uuid, timestamptz, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_plus_session(uuid, timestamptz, text, uuid) TO authenticated;

-- --- Paid checkout (service role only) ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prepare_paid_session(_user_id uuid, _offering_id uuid, _scheduled_at timestamptz)
RETURNS TABLE (mentor_id uuid, title text, duration_minutes integer, price numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
BEGIN
  IF NOT public.has_role(_user_id, 'mentee'::public.app_role) THEN
    RAISE EXCEPTION 'Only mentee accounts can book sessions' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mentee_profiles WHERE user_id = _user_id AND onboarded_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Finish your profile before booking' USING ERRCODE = 'P0001';
  END IF;
  SELECT off.id, off.mentor_id, off.title, off.price, off.duration_minutes
    INTO o
  FROM public.mentorship_offerings off
  JOIN public.mentor_profiles mp ON mp.user_id = off.mentor_id
  JOIN public.users u ON u.id = off.mentor_id
  WHERE off.id = _offering_id AND off.status = 'active' AND mp.is_active AND NOT u.is_disabled;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'This session isn''t available to book' USING ERRCODE = 'P0001';
  END IF;
  IF o.mentor_id = _user_id THEN
    RAISE EXCEPTION 'You can''t book your own session' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(o.price, 0) <= 0 THEN
    RAISE EXCEPTION 'This session is free: book it without checkout' USING ERRCODE = 'P0001';
  END IF;
  -- A checkout the mentee abandoned for this exact time no longer blocks them.
  DELETE FROM public.slot_holds h
   WHERE h.mentee_id = _user_id AND h.mentor_id = o.mentor_id AND h.scheduled_at = _scheduled_at;
  IF NOT EXISTS (
    SELECT 1 FROM public.mentor_open_slots(o.id, (_scheduled_at AT TIME ZONE 'Asia/Kolkata')::date, 1, NULL) s WHERE s.starts_at = _scheduled_at
  ) THEN
    RAISE EXCEPTION 'That time is no longer available. Please pick another.' USING ERRCODE = '23P01';
  END IF;
  RETURN QUERY SELECT o.mentor_id, coalesce(nullif(o.title, ''), 'Mentorship session'), o.duration_minutes, o.price;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prepare_paid_session(uuid, uuid, timestamptz) FROM public, anon, authenticated;

-- Tells every admin that a payment needs attention (a refund).
CREATE OR REPLACE FUNCTION public.notify_admins(_title text, _message text, _type text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT r.user_id, _title, _message, _type FROM public.user_roles r WHERE r.role = 'admin'::public.app_role
$$;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_paid_session(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  b jsonb;
  o record;
  link text;
  sid uuid;
  commission numeric;
  gross numeric;
  fee numeric;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL OR p.kind <> 'session' OR p.status <> 'paid' THEN
    RAISE EXCEPTION 'Payment % is not a paid session', _payment_id;
  END IF;
  IF p.session_id IS NOT NULL OR coalesce((p.payload->>'needs_refund')::boolean, false) THEN
    RETURN p.session_id;
  END IF;
  b := p.payload->'booking';
  SELECT off.id, off.mentor_id, off.title, off.duration_minutes, mp.default_meeting_url
    INTO o
  FROM public.mentorship_offerings off
  JOIN public.mentor_profiles mp ON mp.user_id = off.mentor_id
  WHERE off.id = (b->>'offering_id')::uuid;

  DELETE FROM public.slot_holds WHERE payment_id = p.id;
  link := coalesce(nullif(btrim(o.default_meeting_url), ''), 'https://meet.jit.si/mentorle-' || gen_random_uuid());
  BEGIN
    INSERT INTO public.sessions (mentor_id, mentee_id, scheduled_at, duration_minutes, status, title, topic, mentee_notes, meeting_url, offering_id, program_id)
    VALUES (o.mentor_id, p.user_id, (b->>'scheduled_at')::timestamptz, o.duration_minutes, 'booked', coalesce(nullif(o.title, ''), 'Mentorship session'), '',
            left(btrim(coalesce(b->>'notes', '')), 2000), link, o.id, nullif(b->>'program_id', '')::uuid)
    RETURNING id INTO sid;
  EXCEPTION WHEN exclusion_violation OR unique_violation THEN
    -- The slot was taken while they paid (the hold expired): no session, flag the refund.
    UPDATE public.payments
       SET payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('needs_refund', true, 'refund_reason', 'The slot was taken before the payment completed'),
           updated_at = now()
     WHERE id = p.id;
    PERFORM public.notify_admins('Payment needs a refund',
      'A paid session couldn''t be booked because the slot was taken (order ' || coalesce(p.cashfree_order_id, p.id::text) || ', ₹' || p.amount || ').',
      'payment_refund_needed');
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (p.user_id, 'Booking couldn''t be completed',
            'That time was taken while you were paying, so the session wasn''t booked. Your payment of ₹' || p.amount || ' will be refunded.', 'payment_refund_needed');
    RETURN NULL;
  END;

  UPDATE public.payments SET session_id = sid, updated_at = now() WHERE id = p.id;
  SELECT commission_percent INTO commission FROM public.payment_settings LIMIT 1;
  gross := coalesce((p.payload->>'original_amount')::numeric, p.amount); -- the mentor earns on the pre-discount price
  fee := round(gross * coalesce(commission, 0)) / 100;
  INSERT INTO public.mentor_earnings (mentor_id, source, reference_id, gross_amount, fee_amount, net_amount)
  VALUES (o.mentor_id, 'paid_session', sid, gross, fee, gross - fee);
  RETURN sid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_paid_session(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_paid_event(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  ev record;
  reg uuid;
  commission numeric;
  gross numeric;
  fee numeric;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL OR p.kind <> 'event' OR p.status <> 'paid' THEN
    RAISE EXCEPTION 'Payment % is not a paid event', _payment_id;
  END IF;
  IF p.payload ? 'registration_id' THEN
    RETURN (p.payload->>'registration_id')::uuid;
  END IF;
  SELECT id, created_by INTO ev FROM public.events_programs WHERE id = p.reference_id;
  SELECT id INTO reg FROM public.event_participants WHERE event_id = ev.id AND user_id = p.user_id;
  IF reg IS NULL THEN
    INSERT INTO public.event_participants (event_id, user_id, registered_at) VALUES (ev.id, p.user_id, now()) RETURNING id INTO reg;
  END IF;
  UPDATE public.payments SET payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('registration_id', reg), updated_at = now() WHERE id = p.id;
  SELECT commission_percent INTO commission FROM public.payment_settings LIMIT 1;
  gross := coalesce((p.payload->>'original_amount')::numeric, p.amount);
  fee := round(gross * coalesce(commission, 0)) / 100;
  INSERT INTO public.mentor_earnings (mentor_id, source, reference_id, gross_amount, fee_amount, net_amount)
  VALUES (ev.created_by, 'paid_event', reg, gross, fee, gross - fee);
  RETURN reg;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_paid_event(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_membership(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  plan public.subscription_plans%ROWTYPE;
  current public.memberships%ROWTYPE;
  mid uuid;
  ends timestamptz;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL OR p.kind <> 'membership' OR p.status <> 'paid' THEN
    RAISE EXCEPTION 'Payment % is not a paid membership', _payment_id;
  END IF;
  IF p.payload ? 'membership_id' THEN
    RETURN (p.payload->>'membership_id')::uuid;
  END IF;
  SELECT * INTO plan FROM public.subscription_plans WHERE id = p.reference_id;
  -- Renewing the same plan early adds the time to the end of the current pass.
  SELECT * INTO current FROM public.memberships
   WHERE user_id = p.user_id AND plan_id = plan.id AND status = 'active' AND current_period_end > now()
   ORDER BY current_period_end DESC LIMIT 1 FOR UPDATE;
  IF current.id IS NOT NULL THEN
    ends := current.current_period_end + make_interval(months => coalesce(plan.access_months, 12));
    UPDATE public.memberships SET current_period_end = ends, updated_at = now() WHERE id = current.id;
    mid := current.id;
  ELSE
    ends := now() + make_interval(months => coalesce(plan.access_months, 12));
    INSERT INTO public.memberships (user_id, plan_id, status, started_at, current_period_start, current_period_end, quota_anchor_day, auto_renew, cancel_at_period_end)
    VALUES (p.user_id, plan.id, 'active', now(), now(), ends, least(extract(day FROM now() AT TIME ZONE 'Asia/Kolkata')::integer, 28), false, true)
    RETURNING id INTO mid;
  END IF;
  UPDATE public.payments SET payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('membership_id', mid), updated_at = now() WHERE id = p.id;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (p.user_id, plan.name || ' is active',
          'Thanks for joining. Your ' || plan.name || ' is valid until ' || to_char(ends AT TIME ZONE 'Asia/Kolkata', 'Mon DD, YYYY') || '.', 'membership_activated');
  RETURN mid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.activate_membership(uuid) FROM public, anon, authenticated;

-- --- Public offerings: say which ones a free session can book (mentorle.in's booking dialog) -----------------

DROP FUNCTION IF EXISTS public.list_public_offerings();
CREATE FUNCTION public.list_public_offerings()
RETURNS TABLE (
  id uuid, title text, description text, duration_minutes integer, price numeric, category text, status text, mentor_id uuid,
  mentor_full_name text, mentor_avatar_url text, mentor_current_role text, plus_eligible boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.description, o.duration_minutes, o.price, o.category, o.status, o.mentor_id,
         u.full_name, u.avatar_url, mp."current_role", coalesce(o.plus_eligible, false)
  FROM public.mentorship_offerings o
  JOIN public.users u ON u.id = o.mentor_id
  LEFT JOIN public.mentor_profiles mp ON mp.user_id = o.mentor_id
  WHERE o.status = 'active'
    AND COALESCE(u.is_disabled, false) = false
    AND COALESCE(mp.is_active, true) = true
  ORDER BY o.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.list_public_offerings() TO anon, authenticated;
