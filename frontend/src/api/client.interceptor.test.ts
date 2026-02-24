import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeAxiosInstance = {
  (config: unknown): Promise<unknown>;
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  interceptors: {
    request: { use: ReturnType<typeof vi.fn> };
    response: { use: ReturnType<typeof vi.fn> };
  };
  __requestHandlers: Array<(config: Record<string, unknown>) => Record<string, unknown>>;
  __responseErrorHandlers: Array<(error: unknown) => Promise<unknown>>;
};

const axiosState = vi.hoisted(() => ({
  instances: [] as FakeAxiosInstance[],
}));

const createFakeInstance = (): FakeAxiosInstance => {
  const requestHandlers: Array<(config: Record<string, unknown>) => Record<string, unknown>> = [];
  const responseErrorHandlers: Array<(error: unknown) => Promise<unknown>> = [];

  const instance = vi.fn(async (config: unknown) => ({ data: { ok: true }, config })) as unknown as FakeAxiosInstance;
  instance.post = vi.fn(async () => ({ data: { access_token: "refreshed" } }));
  instance.get = vi.fn(async () => ({ data: {} }));
  instance.__requestHandlers = requestHandlers;
  instance.__responseErrorHandlers = responseErrorHandlers;
  instance.interceptors = {
    request: {
      use: vi.fn((handler: (config: Record<string, unknown>) => Record<string, unknown>) => {
        requestHandlers.push(handler);
        return requestHandlers.length;
      }),
    },
    response: {
      use: vi.fn((_: unknown, errorHandler: (error: unknown) => Promise<unknown>) => {
        responseErrorHandlers.push(errorHandler);
        return responseErrorHandlers.length;
      }),
    },
  };

  return instance;
};

vi.mock("axios", () => {
  const axiosMock = {
    create: vi.fn(() => {
      const instance = createFakeInstance();
      axiosState.instances.push(instance);
      return instance;
    }),
  };

  return {
    default: axiosMock,
  };
});

describe("api/client interceptors", () => {
  beforeEach(() => {
    vi.resetModules();
    axiosState.instances.length = 0;
    document.cookie = "";
  });

  const loadModule = async () => {
    const clientModule = await import("./client");
    const api = axiosState.instances[0];
    const authApi = axiosState.instances[1];

    return {
      api,
      authApi,
      setGlobalErrorHandler: clientModule.setGlobalErrorHandler,
      parseApiErrorMessage: clientModule.parseApiErrorMessage,
    };
  };

  it("attaches csrf header for mutable methods", async () => {
    const { api } = await loadModule();
    document.cookie = "csrf_token=test-token";

    const config = api.__requestHandlers[0]({ method: "post", headers: {} });

    expect((config.headers as Record<string, string>)["x-csrf-token"]).toBe("test-token");
  });

  it("does not attach csrf header for GET", async () => {
    const { api } = await loadModule();
    document.cookie = "csrf_token=test-token";

    const config = api.__requestHandlers[0]({ method: "get", headers: {} });

    expect((config.headers as Record<string, string>)["x-csrf-token"]).toBeUndefined();
  });

  it("deduplicates concurrent 401 refresh attempts", async () => {
    const { api, authApi } = await loadModule();

    let resolveRefresh: (value: unknown) => void = () => {};
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    authApi.post.mockReturnValue(refreshPromise);

    const handler = api.__responseErrorHandlers[0];

    const reqA = handler({
      response: { status: 401 },
      config: { url: "/rooms", method: "get", headers: {} },
    });
    const reqB = handler({
      response: { status: 401 },
      config: { url: "/bookings", method: "get", headers: {} },
    });

    expect(authApi.post).toHaveBeenCalledTimes(1);

    resolveRefresh({ data: { access_token: "new-token" } });
    await Promise.all([reqA, reqB]);

    expect(api).toHaveBeenCalledTimes(2);
  });

  it("maps login 422 to friendly message and triggers global handler", async () => {
    const { api, setGlobalErrorHandler } = await loadModule();
    const handler = vi.fn();
    setGlobalErrorHandler(handler);

    const interceptor = api.__responseErrorHandlers[0];

    await expect(
      interceptor({
        response: {
          status: 422,
          data: { message: "raw-backend-message" },
        },
        config: { url: "/auth/login", method: "post", headers: {} },
      }),
    ).rejects.toBeDefined();

    expect(handler).toHaveBeenCalledWith(
      "Payload inválido. Verificá hotel (nombre o ID), usuario y contraseña.",
      422,
    );
  });

  it("parseApiErrorMessage prefers message, then error, then fallback", async () => {
    const { parseApiErrorMessage } = await loadModule();

    expect(parseApiErrorMessage({ message: "from-message" })).toBe("from-message");
    expect(parseApiErrorMessage({ error: "from-error" })).toBe("from-error");
    expect(parseApiErrorMessage(undefined)).toBe("Error inesperado en el servidor");
  });
});
