alter table public.mentee_profiles
  add column if not exists headline text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists linkedin_url text not null default '',
  add column if not exists preferred_mentor_areas text[] not null default '{}',
  add column if not exists onboarded_at timestamptz;

create index if not exists idx_mentee_profiles_user_id on public.mentee_profiles(user_id);