
-- Badge tier enum
DO $$ BEGIN
  CREATE TYPE public.badge_tier AS ENUM ('bronze', 'silver', 'gold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Badges catalog
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tier public.badge_tier NOT NULL,
  description text NOT NULL DEFAULT '',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  icon_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active badges" ON public.badges
  FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage badges" ON public.badges
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER badges_updated_at BEFORE UPDATE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER badges_audit AFTER INSERT OR UPDATE OR DELETE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Mentor badges (awards)
CREATE TABLE IF NOT EXISTS public.mentor_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_reason text NOT NULL DEFAULT '',
  UNIQUE (mentor_id, badge_id)
);
ALTER TABLE public.mentor_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read mentor_badges" ON public.mentor_badges
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage mentor_badges" ON public.mentor_badges
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER mentor_badges_audit AFTER INSERT OR UPDATE OR DELETE ON public.mentor_badges
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE INDEX IF NOT EXISTS mentor_badges_mentor_idx ON public.mentor_badges (mentor_id);

-- Leaderboard snapshot
CREATE TABLE IF NOT EXISTS public.mentor_leaderboard_stats (
  mentor_id uuid PRIMARY KEY,
  completed_sessions_30d integer NOT NULL DEFAULT 0,
  avg_rating_30d numeric(3,2) NOT NULL DEFAULT 0,
  mentee_count_30d integer NOT NULL DEFAULT 0,
  score numeric(10,2) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mentor_leaderboard_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read leaderboard" ON public.mentor_leaderboard_stats
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage leaderboard" ON public.mentor_leaderboard_stats
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Branding additions
ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS mentor_community_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS leaderboard_enabled boolean NOT NULL DEFAULT true;

-- Seed default badges
INSERT INTO public.badges (code, name, tier, description, criteria) VALUES
  ('bronze_mentor', 'Bronze Mentor', 'bronze', 'Completed 5 sessions', '{"min_completed_sessions": 5}'::jsonb),
  ('silver_mentor', 'Silver Mentor', 'silver', 'Completed 20 sessions with avg rating ≥ 4.0', '{"min_completed_sessions": 20, "min_avg_rating": 4.0}'::jsonb),
  ('gold_mentor', 'Gold Mentor', 'gold', 'Completed 50 sessions with avg rating ≥ 4.5 and mentored 10+ mentees', '{"min_completed_sessions": 50, "min_avg_rating": 4.5, "min_mentee_count": 10}'::jsonb)
ON CONFLICT (code) DO NOTHING;
