-- 1. Sessions: title + topic
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT '';

-- 2. Action items table
CREATE TABLE IF NOT EXISTS public.session_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL,
  mentee_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_action_items_status_chk CHECK (status IN ('open','done'))
);

CREATE INDEX IF NOT EXISTS idx_session_action_items_session ON public.session_action_items(session_id);
CREATE INDEX IF NOT EXISTS idx_session_action_items_mentor ON public.session_action_items(mentor_id);
CREATE INDEX IF NOT EXISTS idx_session_action_items_mentee ON public.session_action_items(mentee_id);

ALTER TABLE public.session_action_items ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access on session_action_items"
  ON public.session_action_items
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Mentor full CRUD on their own action items
CREATE POLICY "Mentors manage own session action items"
  ON public.session_action_items
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

-- Mentee can read their items
CREATE POLICY "Mentees read own session action items"
  ON public.session_action_items
  FOR SELECT
  TO authenticated
  USING (mentee_id = auth.uid());

-- Mentee can mark them done (only toggle status / completed_at, not reassign)
CREATE POLICY "Mentees update own action item status"
  ON public.session_action_items
  FOR UPDATE
  TO authenticated
  USING (mentee_id = auth.uid())
  WITH CHECK (mentee_id = auth.uid());

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_session_action_items_updated_at ON public.session_action_items;
CREATE TRIGGER trg_session_action_items_updated_at
  BEFORE UPDATE ON public.session_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
