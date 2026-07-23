-- Every Cashfree transaction. Money status is written ONLY by the service role
-- (create-order / signature-verified webhook) — no INSERT/UPDATE policy for authenticated.

CREATE TABLE IF NOT EXISTS public.payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind                        text NOT NULL CHECK (kind IN ('session','event','addon','subscription')),
  reference_id                uuid,                                             -- offering / event / addon / plan id (by kind)
  session_id                  uuid REFERENCES public.sessions(id) ON DELETE SET NULL,  -- set once the session is created
  cashfree_order_id           text UNIQUE,
  cashfree_payment_session_id text,
  amount                      numeric(10,2) NOT NULL,
  currency                    text NOT NULL DEFAULT 'INR',
  status                      text NOT NULL DEFAULT 'created'
                                CHECK (status IN ('created','pending','paid','failed','refunded')),
  payload                     jsonb,                                            -- raw Cashfree echo + booking params for the webhook
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_cashfree_order_id ON public.payments(cashfree_order_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payments" ON public.payments;

CREATE POLICY "Users read own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.payments TO authenticated;
