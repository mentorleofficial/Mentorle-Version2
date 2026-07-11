import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BrowseOffering = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string | null;
  status: string;
  mentor_id: string;
  mentor: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    mentor_profiles: {
      current_role: string | null;
    }[] | null;
  } | null;
};

export function useBrowseOfferings() {
  return useQuery<BrowseOffering[]>({
    queryKey: ["browse-offerings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_public_offerings" as any);
      if (error) throw error;
      return ((data as any[]) ?? []).map((row): BrowseOffering => ({
        id: row.id,
        title: row.title,
        description: row.description,
        duration_minutes: row.duration_minutes,
        price: Number(row.price ?? 0),
        category: row.category,
        status: row.status,
        mentor_id: row.mentor_id,
        mentor: {
          id: row.mentor_id,
          full_name: row.mentor_full_name,
          avatar_url: row.mentor_avatar_url,
          mentor_profiles: [{ current_role: row.mentor_current_role ?? null }],
        },
      }));
    },
  });
}
