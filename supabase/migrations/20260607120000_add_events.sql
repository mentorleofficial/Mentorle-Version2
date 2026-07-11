-- Create events_programs table
CREATE TABLE IF NOT EXISTS public.events_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'workshop', 'bootcamp', 'guest_session', 'event', 'other'
  college_name TEXT NOT NULL DEFAULT 'Online',
  location TEXT NOT NULL DEFAULT 'Online',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming', -- 'upcoming', 'ongoing', 'completed', 'cancelled'
  banner_image_url TEXT,
  sessions JSONB DEFAULT '[]'::jsonb,
  max_participants INTEGER,
  registration_deadline TIMESTAMPTZ,
  registration_link TEXT,
  prerequisites TEXT,
  learning_outcomes TEXT,
  speaker_name TEXT,
  speaker_linkedin TEXT,
  speaker_github TEXT,
  speaker_image TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create event_participants table
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completion_status TEXT DEFAULT 'not_started',
  progress_data JSONB DEFAULT '{}'::jsonb,
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.events_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events_programs
DROP POLICY IF EXISTS "Anyone can read events" ON public.events_programs;
CREATE POLICY "Anyone can read events"
  ON public.events_programs
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Mentors can manage own events" ON public.events_programs;
CREATE POLICY "Mentors can manage own events"
  ON public.events_programs
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policies for event_participants
DROP POLICY IF EXISTS "Users can read own registrations" ON public.event_participants;
CREATE POLICY "Users can read own registrations"
  ON public.event_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (
      SELECT 1 FROM public.events_programs ep
      WHERE ep.id = event_id AND ep.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can register for events" ON public.event_participants;
CREATE POLICY "Users can register for events"
  ON public.event_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users or event creators can delete registrations" ON public.event_participants;
CREATE POLICY "Users or event creators can delete registrations"
  ON public.event_participants
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    EXISTS (
      SELECT 1 FROM public.events_programs ep
      WHERE ep.id = event_id AND ep.created_by = auth.uid()
    )
  );

-- Trigger for auto-updating updated_at on events_programs
DROP TRIGGER IF EXISTS set_events_programs_updated_at ON public.events_programs;
CREATE TRIGGER set_events_programs_updated_at BEFORE UPDATE ON public.events_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create event-banners storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-banners', 'event-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for event-banners
DROP POLICY IF EXISTS "Event banners public read" ON storage.objects;
CREATE POLICY "Event banners public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-banners');

DROP POLICY IF EXISTS "Mentors and admins can upload event banners" ON storage.objects;
CREATE POLICY "Mentors and admins can upload event banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-banners' AND (
      public.has_role(auth.uid(), 'mentor'::public.app_role) OR
      public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Mentors and admins can update event banners" ON storage.objects;
CREATE POLICY "Mentors and admins can update event banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-banners' AND (
      public.has_role(auth.uid(), 'mentor'::public.app_role) OR
      public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Mentors and admins can delete event banners" ON storage.objects;
CREATE POLICY "Mentors and admins can delete event banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-banners' AND (
      public.has_role(auth.uid(), 'mentor'::public.app_role) OR
      public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- Update get_booked_times RPC function to union event sessions
CREATE OR REPLACE FUNCTION public.get_booked_times(_mentor_id uuid)
RETURNS TABLE (
  id uuid,
  scheduled_at timestamptz,
  duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Check if caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Check if caller is allowed to book this mentor OR is admin
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_mentee_book_mentor(auth.uid(), _mentor_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- 1. Regular sessions
  SELECT
    s.id,
    s.scheduled_at,
    s.duration_minutes
  FROM public.sessions s
  WHERE s.mentor_id = _mentor_id
    AND s.status = 'booked'

  UNION ALL

  -- 2. Single session events
  SELECT
    ep.id,
    ep.start_date AS scheduled_at,
    EXTRACT(EPOCH FROM (ep.end_date - ep.start_date))::integer / 60 AS duration_minutes
  FROM public.events_programs ep
  WHERE ep.created_by = _mentor_id
    AND ep.status IN ('upcoming', 'ongoing')
    AND (ep.sessions IS NULL OR jsonb_array_length(ep.sessions) = 0)

  UNION ALL

  -- 3. Multi-session events (expanded sessions array)
  SELECT
    ep.id,
    ((s_elem->>'date') || ' ' || (s_elem->>'start_time') || ':00 Asia/Kolkata')::timestamptz AS scheduled_at,
    (EXTRACT(EPOCH FROM (
      ((s_elem->>'date') || ' ' || (s_elem->>'end_time') || ':00 Asia/Kolkata')::timestamptz -
      ((s_elem->>'date') || ' ' || (s_elem->>'start_time') || ':00 Asia/Kolkata')::timestamptz
    ))::integer / 60) AS duration_minutes
  FROM public.events_programs ep,
  LATERAL jsonb_array_elements(ep.sessions) AS s_elem
  WHERE ep.created_by = _mentor_id
    AND ep.status IN ('upcoming', 'ongoing')
    AND ep.sessions IS NOT NULL
    AND jsonb_array_length(ep.sessions) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_times(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_booked_times(uuid) FROM anon, public;
