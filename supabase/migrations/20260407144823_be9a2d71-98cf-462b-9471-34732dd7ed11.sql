
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'mentor', 'mentee');
CREATE TYPE public.session_status AS ENUM ('booked', 'completed', 'cancelled', 'no_show');

-- Users table (profiles linked to auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'mentee',
  external_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (for RLS security-definer checks)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Branding config (single-row)
CREATE TABLE public.branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL DEFAULT 'Mentorship Platform',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '222.2 47.4% 11.2%',
  secondary_color TEXT NOT NULL DEFAULT '210 40% 96.1%',
  accent_color TEXT NOT NULL DEFAULT '210 40% 96.1%',
  login_bg_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- JWT configuration (single-row)
CREATE TABLE public.jwt_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  public_key TEXT NOT NULL DEFAULT '',
  algorithm TEXT NOT NULL DEFAULT 'RS256',
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentor profiles
CREATE TABLE public.mentor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  bio TEXT DEFAULT '',
  expertise TEXT[] DEFAULT '{}',
  years_experience INTEGER DEFAULT 0,
  linkedin_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentor availability slots
CREATE TABLE public.mentor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentee profiles
CREATE TABLE public.mentee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  goals TEXT DEFAULT '',
  interests TEXT[] DEFAULT '{}',
  organization_unit TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status session_status NOT NULL DEFAULT 'booked',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-create user profile + role on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'mentee')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'mentee')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: updated_at auto-update
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.jwt_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mentor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mentee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Audit log trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    jsonb_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Audit triggers on key tables
CREATE TRIGGER audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_branding AFTER UPDATE ON public.branding
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Insert default branding row
INSERT INTO public.branding (app_name) VALUES ('Mentorship Platform');

-- Insert default jwt_config row
INSERT INTO public.jwt_config (issuer, audience, public_key) VALUES ('', '', '');

-- ========== RLS POLICIES ==========

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on users" ON public.users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own profile" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on user_roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- branding (public read, admin write)
ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read branding" ON public.branding FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Admins can update branding" ON public.branding FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- jwt_config (admin only)
ALTER TABLE public.jwt_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on jwt_config" ON public.jwt_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- mentor_profiles
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on mentor_profiles" ON public.mentor_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Mentors manage own profile" ON public.mentor_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated users read mentor profiles" ON public.mentor_profiles FOR SELECT TO authenticated
  USING (true);

-- mentor_availability
ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on mentor_availability" ON public.mentor_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Mentors manage own availability" ON public.mentor_availability FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());
CREATE POLICY "Authenticated users read availability" ON public.mentor_availability FOR SELECT TO authenticated
  USING (true);

-- mentee_profiles
ALTER TABLE public.mentee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on mentee_profiles" ON public.mentee_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Mentees manage own profile" ON public.mentee_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on sessions" ON public.sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Mentors read own sessions" ON public.sessions FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());
CREATE POLICY "Mentors update own sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (mentor_id = auth.uid());
CREATE POLICY "Mentees read own sessions" ON public.sessions FOR SELECT TO authenticated
  USING (mentee_id = auth.uid());
CREATE POLICY "Mentees book sessions" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (mentee_id = auth.uid());

-- feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access on feedback" ON public.feedback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users submit own feedback" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "Users read feedback on own sessions" ON public.feedback FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
      AND (s.mentor_id = auth.uid() OR s.mentee_id = auth.uid())
    )
  );

-- audit_logs (admin read only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
