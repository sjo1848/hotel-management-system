import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const authState = vi.hoisted(() => ({
  status: "authenticated" as "loading" | "authenticated" | "unauthenticated",
  user: { role: "admin" },
}));

vi.mock("./features/auth/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("./features/auth/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/ui/toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/ApiInterceptor", () => ({
  ApiInterceptor: () => null,
}));

vi.mock("./lib/QueryProvider", () => ({
  HMSQueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./layouts/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock("./features/dashboard/DashboardHome", () => ({ default: () => <div>DashboardPage</div> }));
vi.mock("./features/bookings/BookingsPage", () => ({ default: () => <div>BookingsPage</div> }));
vi.mock("./features/rooms/RoomsPage", () => ({ default: () => <div>RoomsPage</div> }));
vi.mock("./features/schedule/CalendarPage", () => ({ default: () => <div>CalendarPage</div> }));
vi.mock("./features/guests/GuestsPage", () => ({ default: () => <div>GuestsPage</div> }));
vi.mock("./features/housekeeping/HousekeepingPage", () => ({ default: () => <div>HousekeepingPage</div> }));
vi.mock("./features/users/UsersPage", () => ({ default: () => <div>UsersPage</div> }));
vi.mock("./features/reports/ReportsPage", () => ({ default: () => <div>ReportsPage</div> }));
vi.mock("./features/dashboard/HotelNetworkPage", () => ({ default: () => <div>NetworkPage</div> }));
vi.mock("./features/auth/LoginPage", () => ({ default: () => <div>LoginPage</div> }));
vi.mock("./features/errors/NotFoundPage", () => ({ default: () => <div>NotFoundPage</div> }));
vi.mock("./features/errors/GeneralErrorPage", () => ({ default: () => <div>GeneralErrorPage</div> }));
vi.mock("./features/errors/AccessDeniedPage", () => ({ default: () => <div>AccessDeniedPage</div> }));

const renderApp = () => render(<App />);

const setRoute = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

describe("App route guards", () => {
  beforeEach(() => {
    authState.status = "authenticated";
    authState.user = { role: "admin" };
  });
  afterEach(() => cleanup());

  it("shows loading message when auth status is loading", async () => {
    setRoute("/");
    authState.status = "loading";

    renderApp();

    expect(screen.getByText("Verificando sesión...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", async () => {
    setRoute("/rooms");
    authState.status = "unauthenticated";

    renderApp();

    expect((await screen.findAllByText("LoginPage")).length).toBeGreaterThan(0);
  });

  it("redirects to forbidden when role lacks capability", async () => {
    setRoute("/users");
    authState.status = "authenticated";
    authState.user = { role: "receptionist" };

    renderApp();

    expect(await screen.findByText("AccessDeniedPage")).toBeInTheDocument();
  });

  it("renders protected route when capability exists", async () => {
    setRoute("/users");
    authState.status = "authenticated";
    authState.user = { role: "admin" };

    renderApp();

    expect(await screen.findByText("UsersPage")).toBeInTheDocument();
  });

  it("routes receptionist home to bookings", async () => {
    setRoute("/");
    authState.status = "authenticated";
    authState.user = { role: "receptionist" };

    renderApp();

    expect(await screen.findByText("BookingsPage")).toBeInTheDocument();
  });

  it("routes housekeeping home to housekeeping board", async () => {
    setRoute("/");
    authState.status = "authenticated";
    authState.user = { role: "housekeeping" };

    renderApp();

    expect(await screen.findByText("HousekeepingPage")).toBeInTheDocument();
  });

  it("routes saas admin home to network", async () => {
    setRoute("/");
    authState.status = "authenticated";
    authState.user = { role: "saas_admin" };

    renderApp();

    expect(await screen.findByText("NetworkPage")).toBeInTheDocument();
  });

  it("grants rooms to admin", async () => {
    setRoute("/rooms");
    authState.status = "authenticated";
    authState.user = { role: "admin" };

    renderApp();

    expect(await screen.findByText("RoomsPage")).toBeInTheDocument();
  });

  it("grants rooms to ops", async () => {
    setRoute("/rooms");
    authState.status = "authenticated";
    authState.user = { role: "ops" };

    renderApp();

    expect(await screen.findByText("RoomsPage")).toBeInTheDocument();
  });

  it("grants rooms to receptionist", async () => {
    setRoute("/rooms");
    authState.status = "authenticated";
    authState.user = { role: "receptionist" };

    renderApp();

    expect(await screen.findByText("RoomsPage")).toBeInTheDocument();
  });

  it("blocks housekeeping from rooms", async () => {
    setRoute("/rooms");
    authState.status = "authenticated";
    authState.user = { role: "housekeeping" };

    renderApp();

    expect(await screen.findByText("AccessDeniedPage")).toBeInTheDocument();
  });

  it("blocks saas_admin from rooms", async () => {
    setRoute("/rooms");
    authState.status = "authenticated";
    authState.user = { role: "saas_admin" };

    renderApp();

    expect(await screen.findByText("AccessDeniedPage")).toBeInTheDocument();
  });

  it("blocks tenant admin from the SaaS network route", async () => {
    setRoute("/network");
    authState.status = "authenticated";
    authState.user = { role: "admin" };

    renderApp();

    expect(await screen.findByText("AccessDeniedPage")).toBeInTheDocument();
  });

  it("keeps admin home on dashboard", async () => {
    setRoute("/");
    authState.status = "authenticated";
    authState.user = { role: "admin" };

    renderApp();

    expect(await screen.findByText("DashboardPage")).toBeInTheDocument();
  });

  it("renders not found page for unknown route", async () => {
    setRoute("/non-existent");

    renderApp();

    expect(await screen.findByText("NotFoundPage")).toBeInTheDocument();
  });
});
