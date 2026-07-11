import { supabase } from "@/integrations/supabase/client";
import type { MenteeOnboardingValues } from "./schema";

export interface MenteeProfileData extends MenteeOnboardingValues {
  avatar_url: string | null;
  email: string;
  onboarded_at: string | null;
}

type MenteeProfileUpdate = {
  user_id: string;
  headline?: string;
  bio?: string;
  organization_unit?: string;
  linkedin_url?: string;
  goals?: string;
  interests?: string[];
  preferred_mentor_areas?: string[];
  onboarded_at?: string;
  academic_details?: string;
  github_url?: string;
  portfolio_url?: string;
  // Extended fields
  phone?: string | null;
  current_status?: string | null;
  education_level?: string | null;
  location?: string | null;
  timezone?: string | null;
  skills?: string[];
  languages?: string[];
  education_details?: object | null;
  work_experience?: object[];
  preferred_industries?: string[];
  preferred_session_types?: string[];
  preferred_time_windows?: string[];
  preferred_mentor_qualities?: string[];
  instagram_url?: string | null;
  resume_url?: string | null;
};

type UserUpdate = {
  full_name?: string;
  avatar_url?: string | null;
};

export async function fetchMenteeProfile(userId: string): Promise<MenteeProfileData> {
  const [{ data: u }, { data: p }] = await Promise.all([
    supabase.from("users").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("mentee_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const profile = p as Record<string, unknown> | null;
  return {
    full_name: u?.full_name ?? "",
    email: u?.email ?? "",
    avatar_url: u?.avatar_url ?? null,
    headline: (profile?.headline as string) ?? "",
    bio: (profile?.bio as string) ?? "",
    organization_unit: p?.organization_unit ?? "",
    linkedin_url: (profile?.linkedin_url as string) ?? "",
    goals: p?.goals ?? "",
    interests: p?.interests ?? [],
    preferred_mentor_areas: ((profile?.preferred_mentor_areas ?? []) as string[]),
    onboarded_at: ((profile?.onboarded_at as string | null) ?? null),
    academic_details: (profile?.academic_details as string) ?? "",
    github_url: (profile?.github_url as string) ?? "",
    portfolio_url: (profile?.portfolio_url as string) ?? "",
    // Extended fields
    phone: (profile?.phone as string | null) ?? null,
    current_status: (profile?.current_status as string | null) ?? null,
    education_level: (profile?.education_level as string | null) ?? null,
    location: (profile?.location as string | null) ?? null,
    timezone: (profile?.timezone as string | null) ?? null,
    skills: (profile?.skills as string[]) ?? [],
    languages: (profile?.languages as string[]) ?? [],
    education_details: (profile?.education_details as object | null) ?? null,
    work_experience: (profile?.work_experience as object[]) ?? [],
    preferred_industries: (profile?.preferred_industries as string[]) ?? [],
    preferred_session_types: (profile?.preferred_session_types as string[]) ?? [],
    preferred_time_windows: (profile?.preferred_time_windows as string[]) ?? [],
    preferred_mentor_qualities: (profile?.preferred_mentor_qualities as string[]) ?? [],
    instagram_url: (profile?.instagram_url as string | null) ?? null,
    resume_url: (profile?.resume_url as string | null) ?? null,
  } as MenteeProfileData;
}

export async function upsertMenteeProfile(
  userId: string,
  values: Partial<MenteeOnboardingValues> & { full_name?: string; avatar_url?: string | null },
  opts?: { markOnboarded?: boolean }
) {
  const { full_name, avatar_url, ...profile } = values;

  if (full_name !== undefined || avatar_url !== undefined) {
    const update: UserUpdate = {};
    if (full_name !== undefined) update.full_name = full_name;
    if (avatar_url !== undefined) update.avatar_url = avatar_url;
    const { error: uErr } = await supabase.from("users").update(update).eq("id", userId);
    if (uErr) throw uErr;
  }

  const payload: MenteeProfileUpdate = { user_id: userId };
  if (profile.headline !== undefined) payload.headline = profile.headline;
  if (profile.bio !== undefined) payload.bio = profile.bio;
  if (profile.organization_unit !== undefined) payload.organization_unit = profile.organization_unit;
  if (profile.linkedin_url !== undefined) payload.linkedin_url = profile.linkedin_url;
  if (profile.goals !== undefined) payload.goals = profile.goals;
  if (profile.interests !== undefined) payload.interests = profile.interests;
  if (profile.preferred_mentor_areas !== undefined)
    payload.preferred_mentor_areas = profile.preferred_mentor_areas;
  if (profile.academic_details !== undefined) payload.academic_details = profile.academic_details;
  if (profile.github_url !== undefined) payload.github_url = profile.github_url;
  if (profile.portfolio_url !== undefined) payload.portfolio_url = profile.portfolio_url;
  if (opts?.markOnboarded) payload.onboarded_at = new Date().toISOString();
  // Extended fields
  const ext = profile as Record<string, unknown>;
  if (ext.phone !== undefined) payload.phone = ext.phone as string | null;
  if (ext.current_status !== undefined) payload.current_status = ext.current_status as string | null;
  if (ext.education_level !== undefined) payload.education_level = ext.education_level as string | null;
  if (ext.location !== undefined) payload.location = ext.location as string | null;
  if (ext.timezone !== undefined) payload.timezone = ext.timezone as string | null;
  if (ext.skills !== undefined) payload.skills = ext.skills as string[];
  if (ext.languages !== undefined) payload.languages = ext.languages as string[];
  if (ext.education_details !== undefined) payload.education_details = ext.education_details as object | null;
  if (ext.work_experience !== undefined) payload.work_experience = ext.work_experience as object[];
  if (ext.preferred_industries !== undefined) payload.preferred_industries = ext.preferred_industries as string[];
  if (ext.preferred_session_types !== undefined) payload.preferred_session_types = ext.preferred_session_types as string[];
  if (ext.preferred_time_windows !== undefined) payload.preferred_time_windows = ext.preferred_time_windows as string[];
  if (ext.preferred_mentor_qualities !== undefined) payload.preferred_mentor_qualities = ext.preferred_mentor_qualities as string[];
  if (ext.instagram_url !== undefined) payload.instagram_url = ext.instagram_url as string | null;
  if (ext.resume_url !== undefined) payload.resume_url = ext.resume_url as string | null;

  const { error: pErr } = await supabase
    .from("mentee_profiles")
    .upsert(payload as any, { onConflict: "user_id" });
  if (pErr) throw pErr;
}

export async function uploadMenteeResume(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `resumes/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("mentee-resumes")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("mentee-resumes").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMenteeAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `avatars/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("branding-assets")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("branding-assets").getPublicUrl(path);
  return data.publicUrl;
}
