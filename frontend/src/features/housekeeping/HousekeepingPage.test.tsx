import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { HMSQueryProvider } from "@/lib/QueryProvider";
import { queryClient } from "@/lib/queryClient";
import { AuthContext } from "@/features/auth/AuthContext";
import HousekeepingPage from "./HousekeepingPage";

const getHousekeepingBoard = vi.fn();
const startCleaning = vi.fn();
const finishCleaning = vi.fn();
const sendRoomToMaintenance = vi.fn();
const returnRoomToDirty = vi.fn();
const setEnabled = vi.fn();
const resetHousekeepingGuide = vi.fn();
const trackHousekeepingEvent = vi.fn();

vi.mock("./services/housekeepingService", () => ({ getHousekeepingBoard: (...args: unknown[]) => getHousekeepingBoard(...args), startCleaning: (...args: unknown[]) => startCleaning(...args), finishCleaning: (...args: unknown[]) => finishCleaning(...args), sendRoomToMaintenance: (...args: unknown[]) => sendRoomToMaintenance(...args), returnRoomToDirty: (...args: unknown[]) => returnRoomToDirty(...args) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/guided/GuidedModeContext", () => ({ useGuidedMode: () => ({ enabled: true, setEnabled, resetHousekeepingGuide, trackHousekeepingEvent, getHousekeepingGuideState: () => ({ steps: [{ id: "start-cleaning", label: "Tomá una habitación dirty", helper: "", actionLabel: "Ver habitaciones dirty", active: true, done: false }], summary: { completed: 0, total: 1, title: "Turno", description: "Revisá la cola" } }) }) }));

const board = { date: "2026-08-02", rooms: [
  { room_id: "r1", room_number: "101", room_type: "DOUBLE", room_status: "Dirty", turnover_today: true, departure_guest_name: "Ana Gómez", departure_booking_status: "CheckedOut" },
  { room_id: "r2", room_number: "102", room_type: "SUITE", room_status: "Cleaning", turnover_today: false },
  { room_id: "r3", room_number: "103", room_type: "DOUBLE", room_status: "Available", turnover_today: false },
], departures_today: [] };

const renderPage = () => render(<HMSQueryProvider><AuthContext.Provider value={{ status: "authenticated", user: { id: "u", username: "ops", hotel_id: "h", role: "ops" }, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }}><HousekeepingPage /></AuthContext.Provider></HMSQueryProvider>);

describe("HousekeepingPage", () => {
  beforeEach(() => { queryClient.clear(); vi.clearAllMocks(); getHousekeepingBoard.mockResolvedValue(board); startCleaning.mockResolvedValue({}); finishCleaning.mockResolvedValue({}); sendRoomToMaintenance.mockResolvedValue({}); returnRoomToDirty.mockResolvedValue({}); });

  it("loads the compact shift workspace with five filters and counts", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Habitación 101 · DOUBLE")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Turno/ })).toHaveAttribute("aria-pressed", "true");
    for (const label of ["Por limpiar", "En limpieza", "Listas", "Mantenimiento"]) expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    expect(screen.getByText("Salidas de hoy: 0")).toBeInTheDocument();
  });

  it("filters the queue and selects a room without mutating", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Buscar habitación, tipo o huésped")).toBeInTheDocument());
    await user.type(screen.getByLabelText("Buscar habitación, tipo o huésped"), "ana gomez");
    expect(screen.getByRole("button", { name: "Ver tarea habitación 101" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver tarea habitación 102" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver tarea habitación 101" }));
    expect(screen.getByText("Estado actual")).toBeInTheDocument();
    expect(startCleaning).not.toHaveBeenCalled();
  });

  it("puts the next operational task first on the mobile surface", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("region", { name: "Siguiente tarea" })).toBeInTheDocument());

    expect(screen.getByRole("heading", { name: "Habitación 101" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Abrir/ }));
    expect(screen.getByText("Estado actual")).toBeInTheDocument();
  });

  it("keeps the last board usable when a refresh fails", async () => {
    const user = userEvent.setup();
    getHousekeepingBoard.mockResolvedValueOnce(board).mockRejectedValueOnce(new Error("network"));
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ver tarea habitación 101" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Actualizar turno" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("se conserva la última información"));
    expect(screen.getByRole("button", { name: "Ver tarea habitación 101" })).toBeInTheDocument();
  });

  it("shows a successful transition immediately without a redundant board request", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ver tarea habitación 101" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Ver tarea habitación 101" }));
    await user.click(screen.getByRole("tab", { name: "Acción" }));
    await user.click(screen.getByRole("button", { name: "Iniciar limpieza" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Finalizar limpieza" })).toBeInTheDocument());
    expect(getHousekeepingBoard).toHaveBeenCalledTimes(1);
  });
});
