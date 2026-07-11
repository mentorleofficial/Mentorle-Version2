import { useQuery } from "@tanstack/react-query";
import { fetchActiveMentors } from "../api/mentors";

export const mentorsQueryKey = ["mentors", "active"] as const;

export function useMentors() {
  return useQuery({
    queryKey: mentorsQueryKey,
    queryFn: fetchActiveMentors,
  });
}
