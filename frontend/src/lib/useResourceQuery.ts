import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateResourceKey, toResourceQueryKey } from "@/lib/queryClient";

export type UseResourceQueryOptions<T> = {
  queryKey: string;
  queryFn: () => Promise<T>;
  staleTimeMs?: number;
  enabled?: boolean;
  retry?: boolean | number;
};

export type UseResourceQueryResult<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
};

type QueryErrorLike = {
  message?: string;
};

const toErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  return (error as QueryErrorLike).message ?? "Error cargando datos";
};

export const invalidateResource = (queryKey: string) => {
  void invalidateResourceKey(queryKey);
};

export function useResourceQuery<T>({
  queryKey,
  queryFn,
  staleTimeMs = 15_000,
  enabled = true,
  retry,
}: UseResourceQueryOptions<T>): UseResourceQueryResult<T> {
  const queryClient = useQueryClient();
  const query = useQuery<T>({
    queryKey: toResourceQueryKey(queryKey),
    queryFn: () => queryFn(),
    staleTime: staleTimeMs,
    enabled,
    retry,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: toResourceQueryKey(queryKey),
      exact: true,
    });
  }, [queryClient, queryKey]);

  return useMemo(
    () => ({
      data: query.data ?? null,
      isLoading: query.isLoading,
      error: toErrorMessage(query.error),
      refetch,
      invalidate,
    }),
    [invalidate, query.data, query.error, query.isLoading, refetch],
  );
}
