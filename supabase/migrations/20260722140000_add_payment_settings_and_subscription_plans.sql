-- Foundation for Mentorle Plus + payments (see docs/PLUS_AND_PAYMENTS_FOUNDATION.md).
-- Admin monetization settings + admin-managed, dynamically-priced Plus plans.
-- RLS is enabled explicitly on every table below — this project has NO rls_auto_enable
-- trigger, and past incidents came from tables created with policies but RLS left off.

-- ── payment_settings (singleton) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_percent  numeric(5,2) NOT NULL DEFAULT 20,   -- paid 1:1: mentor gets price*(1-this/100)
  plus_payout_percent numeric(5,2) NOT NULL DEFAULT 50,   -- plus-consumed: mentor gets list_price*(this/100)
  currency            text NOT NULL DEFAULT 'INR',
  updated_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read payment settings" ON public.payment_settings;
DROP POLICY IF EXISTS "Admins insert payment settings" ON public.payment_settings;
DROP POLICY IF EXISTS "Admins update payment settings" ON public.payment_settings;

CREATE POLICY "Admins read payment settings"
  ON public.payment_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert payment settings"
  ON public.payment_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update payment settings"
  ON public.payment_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.payment_settings TO authenticated;

-- Seed the singleton row with placeholder percentages (admin edits in Settings → Payments).
INSERT INTO public.payment_settings (commission_percent, plus_payout_percent)
SELECT 20, 50
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings);

-- ── subscription_plans ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  interval         text NOT NULL CHECK (interval IN ('month','year')),
  price            numeric(10,2) NOT NULL DEFAULT 0,
  currency         text NOT NULL DEFAULT 'INR',
  monthly_quota    integer NOT NULL DEFAULT 2,          -- free sessions per MONTHLY window (even for yearly)
  benefits         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- display list; not enforcement
  cashfree_plan_id text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins manage plans" ON public.subscription_plans;

CREATE POLICY "Authenticated read active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;

-- Public/anon pricing without exposing has_role (anon cannot EXECUTE it — migration 20260516151559).
CREATE OR REPLACE FUNCTION public.list_active_plans()
RETURNS SETOF public.subscription_plans
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.subscription_plans WHERE is_active ORDER BY price
$$;

GRANT EXECUTE ON FUNCTION public.list_active_plans() TO anon, authenticated;

-- Seed a monthly + yearly plan (placeholder prices; admin sets real prices).
INSERT INTO public.subscription_plans (name, slug, interval, price, monthly_quota, benefits)
VALUES ('Mentorle Plus (Monthly)', 'plus-monthly', 'month', 0, 2,
  '["2 free expert sessions / month","Better discounts on 1:1 sessions","Exclusive offline meetups & industry visits","Special discounts on Mentorle events","Merch & partner discounts","Premium resources: roadmaps, cheatsheets, AI workflows","Add-on support: mock interviews, resume reviews, startup guidance"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.subscription_plans (name, slug, interval, price, monthly_quota, benefits)
VALUES ('Mentorle Plus (Yearly)', 'plus-yearly', 'year', 0, 2,
  '["2 free expert sessions / month","Better discounts on 1:1 sessions","Exclusive offline meetups & industry visits","Special discounts on Mentorle events","Merch & partner discounts","Premium resources: roadmaps, cheatsheets, AI workflows","Add-on support: mock interviews, resume reviews, startup guidance"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
