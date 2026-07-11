import { supabase } from "@/integrations/supabase/client";
import type { MentorProfileFormValues } from "../schema";

export interface MentorProfileData extends MentorProfileFormValues {
  email: string;
  avatar_url: string | null;
  resume_url: string;
  is_active: boolean;
  slug: string | null;
  has_offerings: boolean;
  allow_mentee_attachments: boolean;
}

export async function fetchMentorProfile(userId: string): Promise<MentorProfileData> {
  const [{ data: u, error: uErr }, { data: p, error: pErr }, { count: activeOfferingsCount, error: oErr }] = await Promise.all([
    supabase.from("users").select("full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("mentor_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("mentorship_offerings").select("id", { count: "exact", head: true }).eq("mentor_id", userId).eq("status", "active"),
  ]);
  if (uErr) throw uErr;
  if (pErr) throw pErr;
  if (oErr) throw oErr;

  return {
    full_name: u?.full_name ?? "",
    email: u?.email ?? "",
    avatar_url: u?.avatar_url ?? null,
    phone: (p?.phone as string) ?? "",
    headline: (p?.headline as string) ?? "",
    bio: p?.bio ?? "",
    current_organization: (p?.current_organization as string) ?? "",
    current_role: ((p as any)?.current_role as string) ?? "",
    professional_status: ((p as any)?.professional_status as string) ?? "",
    years_experience: p?.years_experience ?? 0,
    linkedin_url: p?.linkedin_url ?? "",
    portfolio_url: (p?.portfolio_url as string) ?? "",
    expertise: p?.expertise ?? [],
    qualifications: ((p?.qualifications as any) ?? []) as MentorProfileFormValues["qualifications"],
    experiences: ((p?.experiences as any) ?? []) as MentorProfileFormValues["experiences"],
    resume_url: (p?.resume_url as string) ?? "",
    is_active: p?.is_active ?? false,
    slug: ((p as any)?.slug as string | null) ?? null,
    has_offerings: (activeOfferingsCount ?? 0) > 0,
    allow_mentee_attachments: p?.allow_mentee_attachments ?? false,
  };
}

export async function updateMentorProfile(
  userId: string,
  values: MentorProfileFormValues & { avatar_url?: string | null; resume_url?: string }
) {
  const { full_name, avatar_url, ...profile } = values;

  const { error: uErr } = await supabase
    .from("users")
    .update({ full_name, ...(avatar_url !== undefined ? { avatar_url } : {}) })
    .eq("id", userId);
  if (uErr) throw uErr;

  const payload = {
    user_id: userId,
    bio: profile.bio,
    expertise: profile.expertise,
    years_experience: profile.years_experience,
    linkedin_url: profile.linkedin_url,
    portfolio_url: profile.portfolio_url,
    headline: profile.headline,
    phone: profile.phone,
    current_organization: profile.current_organization,
    current_role: profile.current_role,
    professional_status: profile.professional_status,
    qualifications: profile.qualifications as any,
    experiences: profile.experiences as any,
    ...(profile.resume_url !== undefined ? { resume_url: profile.resume_url } : {}),
  };

  const { error: pErr } = await supabase
    .from("mentor_profiles")
    .upsert(payload, { onConflict: "user_id" });
  if (pErr) throw pErr;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `avatars/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("branding-assets")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("branding-assets").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadResume(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("mentor-resumes")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return path;
}

export async function getResumeSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("mentor-resumes")
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function updateGlobalAttachmentToggle(userId: string, allow: boolean) {
  const { error } = await supabase
    .from("mentor_profiles")
    .update({ allow_mentee_attachments: allow } as any)
    .eq("user_id", userId);
  if (error) throw error;
}
