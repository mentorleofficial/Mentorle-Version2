import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const favoritesQueryKey = (userId?: string) => ["mentee_favorites", userId] as const;

export function useMenteeFavorites(userId?: string) {
  return useQuery<string[]>({
    queryKey: favoritesQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentee_favorites")
        .select("mentor_id")
        .eq("mentee_id", userId!);
      if (error) throw error;
      return (data ?? []).map((row) => row.mentor_id);
    },
  });
}

interface ToggleFavoriteInput {
  userId: string;
  mentorId: string;
  isFavorite: boolean;
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation<void, Error, ToggleFavoriteInput>({
    mutationFn: async ({ userId, mentorId, isFavorite }) => {
      if (isFavorite) {
        const { error } = await supabase
          .from("mentee_favorites")
          .delete()
          .eq("mentee_id", userId)
          .eq("mentor_id", mentorId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mentee_favorites")
          .insert({ mentee_id: userId, mentor_id: mentorId });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: favoritesQueryKey(vars.userId) });
    },
  });
}
