import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

export type UseResourceQueryOptions<T> = {
  queryKey: string;
  queryFn: () => Promise<T>;
  staleTimeMs?: number;
  enabled?: boolean;
};

export type UseResourceQueryResult<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
};

export const invalidateResource = (queryKey: string) => {
  cacheStore.delete(queryKey);
};

export function useResourceQuery<T>({
  queryKey,
  queryFn,
  staleTimeMs = 15_000,
  enabled = true,
}: UseResourceQueryOptions<T>): UseResourceQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const queryRef = useRef(queryFn);

  queryRef.current = queryFn;

  const fetchFresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await queryRef.current();
      cacheStore.set(queryKey, { value: result, cachedAt: Date.now() });
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error cargando datos";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, queryKey]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const cached = cacheStore.get(queryKey) as CacheEntry<T> | undefined;
    const isFresh = cached && Date.now() - cached.cachedAt <= staleTimeMs;
    if (isFresh) {
      setData(cached.value);
      setIsLoading(false);
      return;
    }
    void fetchFresh();
  }, [enabled, fetchFresh, queryKey, staleTimeMs]);

  const invalidate = useCallback(() => {
    cacheStore.delete(queryKey);
  }, [queryKey]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch: fetchFresh,
      invalidate,
    }),
    [data, error, fetchFresh, invalidate, isLoading],
  );
}
