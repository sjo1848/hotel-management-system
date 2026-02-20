import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RESOURCE_QUERY_CACHE_EVENT,
  invalidateResource,
  useResourceQuery,
  type ResourceQueryCacheEvent,
} from "@/lib/useResourceQuery";

type ProbeProps = {
  queryKey: string;
  queryFn: () => Promise<string>;
};

const QueryProbe = ({ queryKey, queryFn }: ProbeProps) => {
  const { data, isLoading, error } = useResourceQuery<string>({
    queryKey,
    queryFn,
    staleTimeMs: 60_000,
  });

  return (
    <div>
      <span data-testid="loading">{isLoading ? "loading" : "idle"}</span>
      <span data-testid="data">{data ?? ""}</span>
      <span data-testid="error">{error ?? ""}</span>
    </div>
  );
};

describe("useResourceQuery cache events", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("emits cache_miss and fetch_success on first load", async () => {
    const queryKey = `test:cache:${Date.now()}:miss`;
    const queryFn = vi.fn().mockResolvedValue("ok");
    const events: ResourceQueryCacheEvent[] = [];
    const handler = (event: Event) => {
      events.push((event as CustomEvent<ResourceQueryCacheEvent>).detail);
    };

    window.addEventListener(RESOURCE_QUERY_CACHE_EVENT, handler);
    render(<QueryProbe queryKey={queryKey} queryFn={queryFn} />);

    await waitFor(() => {
      expect(screen.getByTestId("data").textContent).toBe("ok");
    });

    window.removeEventListener(RESOURCE_QUERY_CACHE_EVENT, handler);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "cache_miss" && event.queryKey === queryKey)).toBe(true);
    expect(events.some((event) => event.type === "fetch_success" && event.queryKey === queryKey)).toBe(true);
  });

  it("emits cache_hit for warm query and avoids extra fetch", async () => {
    const queryKey = `test:cache:${Date.now()}:hit`;
    const queryFn = vi.fn().mockResolvedValue("hot");
    const events: ResourceQueryCacheEvent[] = [];
    const handler = (event: Event) => {
      events.push((event as CustomEvent<ResourceQueryCacheEvent>).detail);
    };

    window.addEventListener(RESOURCE_QUERY_CACHE_EVENT, handler);

    const first = render(<QueryProbe queryKey={queryKey} queryFn={queryFn} />);
    await waitFor(() => {
      expect(screen.getByTestId("data").textContent).toBe("hot");
    });
    first.unmount();
    events.length = 0;

    render(<QueryProbe queryKey={queryKey} queryFn={queryFn} />);
    await waitFor(() => {
      expect(screen.getByTestId("data").textContent).toBe("hot");
    });

    window.removeEventListener(RESOURCE_QUERY_CACHE_EVENT, handler);

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "cache_hit" && event.queryKey === queryKey)).toBe(true);
  });

  it("emits invalidate when invalidating a query", () => {
    const queryKey = `test:cache:${Date.now()}:invalidate`;
    const events: ResourceQueryCacheEvent[] = [];
    const handler = (event: Event) => {
      events.push((event as CustomEvent<ResourceQueryCacheEvent>).detail);
    };

    window.addEventListener(RESOURCE_QUERY_CACHE_EVENT, handler);
    invalidateResource(queryKey);
    window.removeEventListener(RESOURCE_QUERY_CACHE_EVENT, handler);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "invalidate", queryKey });
  });
});
