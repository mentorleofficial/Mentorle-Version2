import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Program = Database["public"]["Tables"]["programs"]["Row"];
export type ProgramTag = Database["public"]["Tables"]["program_tags"]["Row"];

export type ProgramWithCounts = Program & {
  mentor_count: number;
  mentee_count: number;
  tags: ProgramTag[];
};

/**
 * Fetch programs the current user belongs to.
 * Mentors → via program_mentors. Mentees → via program_mentees.
 * RLS already restricts both tables to the authenticated user.
 */
export async function fetchMyPrograms(
  userId: string,
  role: "mentor" | "mentee",
): Promise<ProgramWithCounts[]> {
  const linkTable = role === "mentor" ? "program_mentors" : "program_mentees";
  const userCol = role === "mentor" ? "mentor_id" : "mentee_id";

  const { data: links, error: linkErr } = await supabase
    .from(linkTable as any)
    .select("program_id")
    .eq(userCol, userId);
  if (linkErr) throw linkErr;

  const programIds = Array.from(
    new Set(((links || []) as any[]).map((r) => r.program_id).filter(Boolean)),
  );
  if (programIds.length === 0) return [];

  const [{ data: programs, error: pErr }, { data: counts }, { data: tags }] =
    await Promise.all([
      supabase.from("programs").select("*").in("id", programIds).order("starts_on", { ascending: false }),
      // SECURITY DEFINER RPC — returns accurate counts regardless of caller's role
      supabase.rpc("get_program_member_counts", { program_ids: programIds }),
      supabase.from("program_tags").select("*").in("program_id", programIds),
    ]);
  if (pErr) throw pErr;

  const mc: Record<string, number> = {};
  const ec: Record<string, number> = {};
  ((counts as any[]) || []).forEach((r: any) => {
    mc[r.program_id] = Number(r.mentor_count) || 0;
    ec[r.program_id] = Number(r.mentee_count) || 0;
  });

  const tagsBy: Record<string, ProgramTag[]> = {};
  (tags || []).forEach((t) => (tagsBy[t.program_id] = [...(tagsBy[t.program_id] || []), t]));

  return (programs || []).map((p) => ({
    ...p,
    mentor_count: mc[p.id] || 0,
    mentee_count: ec[p.id] || 0,
    tags: tagsBy[p.id] || [],
  }));

}

export type ProgramOverview = {
  program: Program;
  mentors: ProgramMember[];
  tags: ProgramTag[];
  assignedMentor: ProgramMember | null;
};

/**
 * One-shot fetch for the mentee program detail page.
 * Returns program + mentor list + tags + the mentee's assigned mentor.
 */
export async function fetchMenteeProgramOverview(
  slug: string,
  menteeId: string,
): Promise<ProgramOverview | null> {
  const program = await fetchProgramBySlug(slug);
  if (!program) return null;
  const [mentors, tags, assignedMentor] = await Promise.all([
    fetchProgramMentors(program.id),
    fetchProgramTags(program.id),
    fetchMyAssignedMentor(program.id, menteeId),
  ]);
  return { program, mentors, tags, assignedMentor };
}

export async function fetchProgramBySlug(slug: string): Promise<Program | null> {
  const { data, error } = await supabase.from("programs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export type MentorProfileSummary = {
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
  current_role: string | null;
  headline: string | null;
  current_organization: string | null;
};

export type ProgramMember = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  headline?: string | null;
  slug?: string | null;
  mentor_profiles?: MentorProfileSummary[];
};

type PublicMentorRow = {
  user_id: string;
  slug: string | null;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[] | null;
  years_experience: number | null;
  current_role: string | null;
  current_organization?: string | null;
};

function mapPublicMentorRow(row: PublicMentorRow, email = ""): ProgramMember {
  return {
    id: row.user_id,
    full_name: row.full_name,
    email,
    avatar_url: row.avatar_url ?? null,
    headline: row.headline ?? null,
    slug: row.slug ?? null,
    mentor_profiles: [
      {
        bio: row.bio ?? null,
        expertise: row.expertise ?? null,
        years_experience: row.years_experience ?? null,
        current_role: row.current_role ?? null,
        headline: row.headline ?? null,
        current_organization: row.current_organization ?? null,
      },
    ],
  };
}

export async function fetchProgramMentors(programId: string): Promise<ProgramMember[]> {
  const { data: rows } = await supabase
    .from("program_mentors")
    .select("mentor_id")
    .eq("program_id", programId);
  const ids = new Set((rows || []).map((r) => r.mentor_id).filter(Boolean));
  if (ids.size === 0) return [];

  const { data: publicMentors, error } = await supabase.rpc("list_public_mentors");
  if (error) throw error;

  return (publicMentors ?? [])
    .filter((m) => ids.has(m.user_id))
    .map((m) => mapPublicMentorRow(m as PublicMentorRow))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function fetchProgramMentees(programId: string): Promise<ProgramMember[]> {
  const { data: rows } = await supabase
    .from("program_mentees")
    .select("mentee_id")
    .eq("program_id", programId);
  const ids = Array.from(new Set((rows || []).map((r) => r.mentee_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .in("id", ids)
    .eq("is_disabled", false)
    .order("full_name");
  return (users || []) as ProgramMember[];
}

export async function fetchProgramTags(programId: string): Promise<ProgramTag[]> {
  const { data } = await supabase
    .from("program_tags")
    .select("*")
    .eq("program_id", programId)
    .order("label");
  return data || [];
}

/**
 * For a given mentee in a program, return the assigned mentor (if any).
 */
export async function fetchMyAssignedMentor(programId: string, menteeId: string) {
  const { data: row } = await supabase
    .from("mentor_mentee_assignments")
    .select("mentor_id")
    .eq("program_id", programId)
    .eq("mentee_id", menteeId)
    .maybeSingle();
  if (!row?.mentor_id) return null;

  const [{ data: u }, { data: profileRows, error: profileErr }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, avatar_url")
      .eq("id", row.mentor_id)
      .maybeSingle(),
    supabase.rpc("get_public_mentor", { _slug_or_id: row.mentor_id }),
  ]);
  if (profileErr) throw profileErr;

  const mp = profileRows?.[0] as PublicMentorRow | undefined;
  if (mp) return mapPublicMentorRow(mp, u?.email ?? "");
  if (!u) return null;

  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    avatar_url: u.avatar_url,
  } satisfies ProgramMember;
}

/**
 * For a given mentor in a program, return the explicit 1:1 assigned mentees.
 */
export async function fetchMyAssignedMentees(
  programId: string,
  mentorId: string,
): Promise<ProgramMember[]> {
  const { data: rows } = await supabase
    .from("mentor_mentee_assignments")
    .select("mentee_id")
    .eq("program_id", programId)
    .eq("mentor_id", mentorId);
  const ids = Array.from(new Set((rows || []).map((r) => r.mentee_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, avatar_url")
    .in("id", ids)
    .eq("is_disabled", false)
    .order("full_name");
  return (users || []) as ProgramMember[];
}
