import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, AuthContextValue, AuthProvider } from "./AuthContext";

const authServiceMocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

vi.mock("./authService", () => ({
  login: authServiceMocks.login,
  logout: authServiceMocks.logout,
  me: authServiceMocks.me,
}));

let latestContext: AuthContextValue | null = null;

const ContextProbe = () => (
  <AuthContext.Consumer>
    {(value) => {
      latestContext = value;
      return (
        <>
          <div data-testid="status">{value.status}</div>
          <div data-testid="user">{value.user?.username ?? "none"}</div>
        </>
      );
    }}
  </AuthContext.Consumer>
);

describe("AuthProvider session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestContext = null;
    window.history.pushState({}, "", "/");
  });

  it("hydrates authenticated user on boot outside /login", async () => {
    authServiceMocks.me.mockResolvedValue({ id: "u1", username: "admin", role: "admin" });

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("user").textContent).toBe("admin");
    expect(authServiceMocks.me).toHaveBeenCalledTimes(1);
  });

  it("falls back to unauthenticated when /auth/me fails", async () => {
    authServiceMocks.me.mockRejectedValue(new Error("unauthorized"));

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(authServiceMocks.me).toHaveBeenCalledTimes(1);
  });

  it("skips bootstrap /auth/me when route is /login", async () => {
    window.history.pushState({}, "", "/login");

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(authServiceMocks.me).not.toHaveBeenCalled();
  });

  it("login triggers auth/login then refreshes user", async () => {
    authServiceMocks.me.mockResolvedValue({ id: "u1", username: "admin", role: "admin" });
    authServiceMocks.login.mockResolvedValue({
      access_token: "tkn",
      expires_in: 3600,
      hotel_id: "h1",
      role: "admin",
    });

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    await act(async () => {
      await latestContext!.login("admin", "secret", "hotel-1");
    });

    expect(authServiceMocks.login).toHaveBeenCalledWith("admin", "secret", "hotel-1");
    expect(authServiceMocks.me).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });

  it("logout sets unauthenticated even if api logout fails", async () => {
    authServiceMocks.me.mockResolvedValue({ id: "u1", username: "admin", role: "admin" });
    authServiceMocks.logout.mockRejectedValue(new Error("network"));

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    await act(async () => {
      await expect(latestContext!.logout()).rejects.toThrow("network");
    });

    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("deduplicates concurrent refreshUser calls", async () => {
    authServiceMocks.me.mockResolvedValue({ id: "u1", username: "admin", role: "admin" });

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    let resolver: ((value: unknown) => void) | null = null;
    const delayed = new Promise((resolve) => {
      resolver = resolve;
    });
    authServiceMocks.me.mockReturnValueOnce(delayed as Promise<unknown>);

    const first = latestContext!.refreshUser();
    const second = latestContext!.refreshUser();

    expect(authServiceMocks.me).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolver?.({ id: "u2", username: "ops", role: "ops" });
      await Promise.all([first, second]);
    });

    expect(screen.getByTestId("user").textContent).toBe("ops");
  });

  it("refreshUser failure resets session state", async () => {
    authServiceMocks.me.mockResolvedValue({ id: "u1", username: "admin", role: "admin" });

    render(
      <AuthProvider>
        <ContextProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    authServiceMocks.me.mockRejectedValueOnce(new Error("expired"));

    await act(async () => {
      await expect(latestContext!.refreshUser()).rejects.toThrow("expired");
    });

    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });
});
