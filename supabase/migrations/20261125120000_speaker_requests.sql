-- Speaker requests from mentorle.in's /speaker-hub/request: an organiser asks Mentorle for a speaker (a named one from
-- the Speaker Hub, or "match me"). Anyone can submit through submit_speaker_request(), which checks the fields,
-- limits repeat submissions and tells admins (bell notification). Admins work through them on Admin → Speaker requests.

CREATE TABLE IF NOT EXISTS public.speaker_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_slug  text,
  speaker_name  text,
  name          text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  email         text NOT NULL CHECK (length(email) BETWEEN 5 AND 255),
  phone         text CHECK (phone IS NULL OR length(phone) <= 25),
  organization  text NOT NULL CHECK (length(organization) BETWEEN 2 AND 150),
  event_name    text NOT NULL CHECK (length(event_name) BETWEEN 2 AND 150),
  event_type    text NOT NULL CHECK (event_type IN ('conference', 'university', 'corporate', 'workshop', 'webinar', 'other')),
  event_date    date,
  audience_size text NOT NULL CHECK (audience_size IN ('under_50', '50_200', '200_500', '500_plus')),
  format        text NOT NULL CHECK (format IN ('in_person', 'online', 'hybrid')),
  city          text CHECK (city IS NULL OR length(city) <= 100),
  message       text CHECK (message IS NULL OR length(message) <= 2000),
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_speaker_requests_created ON public.speaker_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaker_requests_email ON public.speaker_requests (lower(email), created_at DESC);

ALTER TABLE public.speaker_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.speaker_requests FROM anon, authenticated;
GRANT SELECT, UPDATE (status, updated_at) ON public.speaker_requests TO authenticated;
DROP POLICY IF EXISTS "Admins read speaker requests" ON public.speaker_requests;
CREATE POLICY "Admins read speaker requests" ON public.speaker_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins update speaker requests" ON public.speaker_requests;
CREATE POLICY "Admins update speaker requests" ON public.speaker_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- The public way in. Returns the new request's id. At most 3 requests per email address an hour, and 30 an hour in
-- total, so the form can't be used to flood admins.
CREATE OR REPLACE FUNCTION public.submit_speaker_request(
  _name text,
  _email text,
  _phone text,
  _organization text,
  _event_name text,
  _event_type text,
  _event_date date,
  _audience_size text,
  _format text,
  _city text,
  _message text,
  _speaker_slug text DEFAULT NULL,
  _speaker_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  addr text := lower(trim(coalesce(_email, '')));
  rid uuid;
BEGIN
  IF addr !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF _event_date IS NOT NULL AND _event_date < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'The event date is in the past.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.speaker_requests WHERE lower(email) = addr AND created_at > now() - interval '1 hour') >= 3
     OR (SELECT count(*) FROM public.speaker_requests WHERE created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Too many requests. Please try again in a while.' USING ERRCODE = 'P0001', HINT = 'rate_limited';
  END IF;

  INSERT INTO public.speaker_requests (speaker_slug, speaker_name, name, email, phone, organization, event_name, event_type, event_date,
                                       audience_size, format, city, message, user_id)
  VALUES (nullif(trim(coalesce(_speaker_slug, '')), ''), nullif(trim(coalesce(_speaker_name, '')), ''), trim(_name), addr,
          nullif(trim(coalesce(_phone, '')), ''), trim(_organization), trim(_event_name), _event_type, _event_date,
          _audience_size, _format, nullif(trim(coalesce(_city, '')), ''), nullif(trim(coalesce(_message, '')), ''), auth.uid())
  RETURNING id INTO rid;

  PERFORM public.notify_admins(
    'New speaker request',
    trim(_organization) || ' asked for ' || coalesce(nullif(trim(coalesce(_speaker_name, '')), ''), 'a speaker') || ' for "' || trim(_event_name) || '"'
      || CASE WHEN _event_date IS NOT NULL THEN ' on ' || to_char(_event_date, 'Mon DD, YYYY') ELSE '' END || '.',
    'speaker_request'
  );
  RETURN rid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_speaker_request(text, text, text, text, text, text, date, text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_speaker_request(text, text, text, text, text, text, date, text, text, text, text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
