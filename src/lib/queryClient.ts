import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { handleError } from "./handleError";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only surface a toast when a component is actively observing this query
      if (query.state.data !== undefined) {
        handleError(error, "Failed to refresh data");
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleError(error, "Action failed"),
  }),
});
