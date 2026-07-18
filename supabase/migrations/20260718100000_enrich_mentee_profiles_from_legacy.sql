-- The 2026-07-11 backfill from legacy mentee_data copied goals/interests/skills but dropped
-- bio, contact links, education, work background, and preferences. Copy them across where
-- the new profile is still empty, never overwriting values users have since edited.
DO $$
BEGIN
  IF to_regclass('public.mentee_data') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.mentee_profiles mp
  SET
    -- final fallback to mp.<col> keeps NOT NULL DEFAULT '' columns at '' when legacy is null
    bio             = COALESCE(NULLIF(mp.bio,''), md.bio, mp.bio),
    phone           = COALESCE(NULLIF(mp.phone,''), md.phone, mp.phone),
    education_level = COALESCE(NULLIF(mp.education_level,''), md.education_level, mp.education_level),
    current_status  = COALESCE(NULLIF(mp.current_status,''), md.current_status, mp.current_status),
    location        = COALESCE(NULLIF(mp.location,''), md.location, mp.location),
    linkedin_url    = COALESCE(NULLIF(mp.linkedin_url,''), md.linkedin_url, mp.linkedin_url),
    github_url      = COALESCE(NULLIF(mp.github_url,''), md.github_url, mp.github_url),
    instagram_url   = COALESCE(NULLIF(mp.instagram_url,''), md.instagram_url, mp.instagram_url),
    portfolio_url   = COALESCE(NULLIF(mp.portfolio_url,''), md.portfolio_url, mp.portfolio_url),
    resume_url      = COALESCE(NULLIF(mp.resume_url,''), md.resume_url, mp.resume_url),
    languages       = CASE WHEN COALESCE(array_length(mp.languages,1),0) = 0
                           THEN COALESCE(md.languages, mp.languages)
                           ELSE mp.languages END,
    preferred_industries = CASE WHEN COALESCE(array_length(mp.preferred_industries,1),0) = 0
                                THEN COALESCE(md.preferred_industries, mp.preferred_industries)
                                ELSE mp.preferred_industries END,
    education_details = COALESCE(mp.education_details, md.education),
    -- legacy work_background is a single object; the app expects an array of entries
    work_experience = CASE
      WHEN mp.work_experience IS NOT NULL AND mp.work_experience <> '[]'::jsonb THEN mp.work_experience
      WHEN jsonb_typeof(md.work_background) = 'array' THEN md.work_background
      WHEN jsonb_typeof(md.work_background) = 'object' AND md.work_background <> '{}'::jsonb
        THEN jsonb_build_array(md.work_background)
      ELSE mp.work_experience END,
    preferred_session_types = CASE
      WHEN COALESCE(array_length(mp.preferred_session_types,1),0) = 0
       AND jsonb_typeof(md.preferences->'session_type') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(md.preferences->'session_type'))
      ELSE mp.preferred_session_types END,
    preferred_mentor_qualities = CASE
      WHEN COALESCE(array_length(mp.preferred_mentor_qualities,1),0) = 0
       AND jsonb_typeof(md.preferences->'mentor_qualities') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(md.preferences->'mentor_qualities'))
      ELSE mp.preferred_mentor_qualities END,
    -- legacy shape: {"morning": bool, "evening": bool, ...} -> keep only the true keys
    preferred_time_windows = CASE
      WHEN COALESCE(array_length(mp.preferred_time_windows,1),0) = 0
       AND jsonb_typeof(md.preferences->'preferred_time_windows') = 'object'
        THEN ARRAY(SELECT key FROM jsonb_each_text(md.preferences->'preferred_time_windows') WHERE value = 'true')
      ELSE mp.preferred_time_windows END
  FROM public.mentee_data md
  WHERE md.user_id = mp.user_id;
END $$;

-- Mentees who completed the old mentorle.in onboarding (any substantive field filled)
-- should not be forced through the new wizard.
UPDATE public.mentee_profiles
SET onboarded_at = created_at
WHERE onboarded_at IS NULL
  AND (COALESCE(goals,'') <> ''
       OR COALESCE(array_length(interests,1),0) > 0
       OR COALESCE(bio,'') <> ''
       OR COALESCE(array_length(skills,1),0) > 0);
