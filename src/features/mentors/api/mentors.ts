import { supabase } from "@/integrations/supabase/client";

export interface MentorWithProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  mentor_profiles: {
    bio: string | null;
    expertise: string[] | null;
    years_experience: number | null;
    current_role: string | null;
    headline: string | null;
    current_organization: string | null;
  }[];
}

/**
 * Fetch all active mentors with their public profile data.
 * Uses the `list_public_mentors` security-definer RPC so we never
 * expose private columns (email, phone, resume_url) to authenticated users.
 */
export async function fetchActiveMentors(): Promise<MentorWithProfile[]> {
  const { data, error } = await supabase.rpc("list_public_mentors");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.user_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    headline: row.headline ?? null,
    mentor_profiles: [
      {
        bio: row.bio,
        expertise: row.expertise,
        years_experience: row.years_experience,
        current_role: row.current_role ?? null,
        headline: row.headline ?? null,
        current_organization: null,
      },
    ],
  }));
}
