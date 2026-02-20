import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
export const RESOURCE_QUERY_CACHE_EVENT = "hms:resource-query-cache";

export type ResourceQueryCacheEventType =
  | "cache_hit"
  | "cache_miss"
  | "fetch_success"
  | "fetch_error"
  | "invalidate";

export type ResourceQueryCacheEvent = {
  type: ResourceQueryCacheEventType;
  queryKey: string;
  timestamp: string;
  staleTimeMs?: number;
  ageMs?: number;
  error?: string;
};

const dispatchCacheEvent = (event: Omit<ResourceQueryCacheEvent, "timestamp">) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ResourceQueryCacheEvent>(RESOURCE_QUERY_CACHE_EVENT, {
      detail: {
        ...event,
        timestamp: new Date().toISOString(),
      },
    }),
  );
};

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
  dispatchCacheEvent({
    type: "invalidate",
    queryKey,
  });
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
      dispatchCacheEvent({
        type: "fetch_success",
        queryKey,
      });
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error cargando datos";
      dispatchCacheEvent({
        type: "fetch_error",
        queryKey,
        error: message,
      });
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
      dispatchCacheEvent({
        type: "cache_hit",
        queryKey,
        staleTimeMs,
        ageMs: Date.now() - cached.cachedAt,
      });
      setData(cached.value);
      setIsLoading(false);
      return;
    }
    dispatchCacheEvent({
      type: "cache_miss",
      queryKey,
      staleTimeMs,
    });
    void fetchFresh();
  }, [enabled, fetchFresh, queryKey, staleTimeMs]);

  const invalidate = useCallback(() => {
    cacheStore.delete(queryKey);
    dispatchCacheEvent({
      type: "invalidate",
      queryKey,
    });
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
