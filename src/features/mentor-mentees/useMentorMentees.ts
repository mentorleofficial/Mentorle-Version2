import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MenteeRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
}

export interface ProgramLite {
  id: string;
  name: string;
  status: string;
  slug: string;
  color: string;
}

export interface MentorMenteeRow {
  key: string;
  program: ProgramLite;
  mentee: MenteeRow;
  assigned: boolean;
}

export const mentorMenteesKey = (userId?: string) => ["mentor", "mentees", userId] as const;

export function useMentorMentees(userId?: string) {
  return useQuery({
    queryKey: mentorMenteesKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MentorMenteeRow[]> => {
      // 1) Programs the mentor belongs to
      const { data: mp } = await supabase
        .from("program_mentors")
        .select("program_id")
        .eq("mentor_id", userId!);
      const programIds = Array.from(
        new Set((mp ?? []).map((r) => r.program_id).filter(Boolean) as string[])
      );
      if (programIds.length === 0) return [];

      // 2/3/4 — parallel
      const [progsRes, enrollRes, assignRes] = await Promise.all([
        supabase
          .from("programs")
          .select("id,name,status,slug,color")
          .in("id", programIds),
        supabase
          .from("program_mentees")
          .select("program_id, mentee_id")
          .in("program_id", programIds),
        supabase
          .from("mentor_mentee_assignments")
          .select("program_id, mentee_id")
          .eq("mentor_id", userId!),
      ]);

      const progById: Record<string, ProgramLite> = {};
      (progsRes.data ?? []).forEach((p) => {
        progById[p.id as string] = p as unknown as ProgramLite;
      });

      const assignedSet = new Set(
        (assignRes.data ?? []).map((a) => `${a.program_id}:${a.mentee_id}`)
      );

      // 5) Mentee user records
      const menteeIds = Array.from(
        new Set((enrollRes.data ?? []).map((e) => e.mentee_id).filter(Boolean) as string[])
      );
      const userById: Record<string, MenteeRow> = {};
      if (menteeIds.length > 0) {
        const { data: us } = await supabase
          .from("users")
          .select("id, full_name, email, avatar_url")
          .in("id", menteeIds)
          .eq("is_disabled", false);
        (us ?? []).forEach((u) => (userById[u.id as string] = u as MenteeRow));
      }

      return (enrollRes.data ?? [])
        .map((e) => {
          const program = progById[e.program_id as string];
          const mentee = userById[e.mentee_id as string];
          if (!program || !mentee) return null;
          return {
            key: `${e.program_id}:${e.mentee_id}`,
            program,
            mentee,
            assigned: assignedSet.has(`${e.program_id}:${e.mentee_id}`),
          } as MentorMenteeRow;
        })
        .filter(Boolean) as MentorMenteeRow[];
    },
  });
}

/** Map mentee_id → list of programs (subset shape used by Sessions page). */
export function selectMenteeProgramMap(rows: MentorMenteeRow[]) {
  const map: Record<string, { name: string; color: string; slug: string }[]> = {};
  for (const r of rows) {
    (map[r.mentee.id] ||= []).push({
      name: r.program.name,
      color: r.program.color,
      slug: r.program.slug,
    });
  }
  return map;
}

export interface MenteeProfileForMentor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  goals: string | null;
  interests: string[] | null;
  organization_unit: string | null;
  preferred_mentor_areas: string[] | null;
  academic_details: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  preferred_time_windows: string[];
  preferred_session_types: string[];
  skills: string[];
  resume_url: string | null;
  linkedin_url: string | null;
  location: string | null;
  timezone: string | null;
  // extended set 2
  email: string | null;
  phone: string | null;
  current_status: string | null;
  education_level: string | null;
  education_details: { degree?: string; field_of_study?: string; school?: string; start_year?: number; end_year?: number } | null;
  work_experience: { company?: string; position?: string; start_date?: string; end_date?: string; description?: string }[] | null;
  languages: string[];
  preferred_industries: string[];
  preferred_mentor_qualities: string[];
  instagram_url: string | null;
}

export function useMenteeDetailsForMentor(menteeId: string | null) {
  return useQuery({
    queryKey: ["mentor", "mentee-details", menteeId],
    enabled: !!menteeId,
    staleTime: 60_000,
    queryFn: async (): Promise<MenteeProfileForMentor> => {
      const { data, error } = await supabase.rpc("get_mentee_profile_for_mentor", {
        _mentee_id: menteeId,
      });
      if (error) throw error;
      const rows = data as MenteeProfileForMentor[] | null;
      if (!rows || rows.length === 0)
        throw new Error("Profile not found or not authorized");
      return rows[0];
    },
  });
}
