import { QueryClient } from "@tanstack/react-query";

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type QueryErrorLike = {
  status?: number;
  message?: string;
};

const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2) return false;
  const status = (error as QueryErrorLike | undefined)?.status;
  if (status === 401 || status === 403 || status === 404) return false;
  if (typeof status === "number") {
    return RETRYABLE_STATUSES.has(status);
  }
  return true;
};

const shouldRetryMutation = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 1) return false;
  const status = (error as QueryErrorLike | undefined)?.status;
  if (status === 401 || status === 403 || status === 404 || status === 409 || status === 422) {
    return false;
  }
  if (typeof status === "number") {
    return RETRYABLE_STATUSES.has(status);
  }
  return true;
};

export const toResourceQueryKey = (queryKey: string) => [queryKey] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 5_000),
    },
    mutations: {
      retry: shouldRetryMutation,
      retryDelay: (attempt: number) => Math.min(300 * 2 ** attempt, 2_000),
    },
  },
});

export const invalidateResourceKey = async (queryKey: string) => {
  queryClient.removeQueries({
    queryKey: toResourceQueryKey(queryKey),
    exact: true,
  });
};

export const invalidateResourcePrefix = async (prefix: string) => {
  await queryClient.invalidateQueries({
    predicate: (query: { queryKey: readonly unknown[] }) => {
      const topKey = query.queryKey[0];
      return typeof topKey === "string" && topKey.startsWith(prefix);
    },
  });
};
