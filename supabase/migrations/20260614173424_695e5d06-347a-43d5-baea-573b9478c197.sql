CREATE TYPE public.general_feedback_category AS ENUM ('feedback', 'concern', 'suggestion', 'review');

CREATE TABLE public.general_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category public.general_feedback_category NOT NULL DEFAULT 'feedback',
  message text NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 1000),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.general_feedback TO authenticated;
GRANT ALL ON public.general_feedback TO service_role;

ALTER TABLE public.general_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own general feedback"
  ON public.general_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own general feedback"
  ON public.general_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all general feedback"
  ON public.general_feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update general feedback"
  ON public.general_feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_general_feedback_user_id ON public.general_feedback(user_id);
CREATE INDEX idx_general_feedback_created_at ON public.general_feedback(created_at DESC);