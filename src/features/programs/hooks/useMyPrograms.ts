import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyPrograms, type ProgramWithCounts } from "../api";

export const useMyPrograms = () => {
  const { user, role } = useAuth();
  return useQuery<ProgramWithCounts[]>({
    queryKey: ["my-programs", user?.id, role],
    queryFn: () => fetchMyPrograms(user!.id, role as "mentor" | "mentee"),
    enabled: !!user?.id && (role === "mentor" || role === "mentee"),
    staleTime: 60_000,
  });
};
