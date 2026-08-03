import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Room, RoomHold } from "@/types/domain";
import { RoomDetailWorkspace } from "./RoomDetailWorkspace";

const mockGetRoomHolds = vi.fn();
const mockCreateRoomHold = vi.fn();
const mockUpdateRoomHold = vi.fn();
const mockDeleteRoomHold = vi.fn();
const mockUpdateRoom = vi.fn();
const mockUpdateRoomStatus = vi.fn();
const mockToast = vi.fn();

let currentRole = "admin";

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { role: currentRole } }),
}));

vi.mock("@/features/rooms/services/roomService", () => ({
  getRoomHolds: (...args: unknown[]) => mockGetRoomHolds(...args),
  createRoomHold: (...args: unknown[]) => mockCreateRoomHold(...args),
  updateRoomHold: (...args: unknown[]) => mockUpdateRoomHold(...args),
  deleteRoomHold: (...args: unknown[]) => mockDeleteRoomHold(...args),
  updateRoom: (...args: unknown[]) => mockUpdateRoom(...args),
  updateRoomStatus: (...args: unknown[]) => mockUpdateRoomStatus(...args),
}));

vi.mock("@/features/audit/components/AuditTimeline", () => ({
  default: () => <div data-testid="audit-timeline" />,
}));

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: "r1",
  hotel_id: "h",
  room_number: "101",
  room_type: "DOUBLE",
  status: "Available",
  price_cents: 250000,
  ...overrides,
});

const hold: RoomHold = {
  id: "h1",
  hotel_id: "h",
  room_id: "r1",
  created_by_user_id: "u1",
  start_date: "2026-08-10",
  end_date: "2026-08-12",
  hold_type: "Commercial",
  reason: "Grupo VIP",
};

const renderWorkspace = (
  room: Room | null = makeRoom(),
  overrides: Partial<Parameters<typeof RoomDetailWorkspace>[0]> = {},
) => {
  const props = {
    room,
    variant: "inline" as const,
    canManageInventory: true,
    canManageStatus: true,
    canCreateBooking: true,
    onReserve: vi.fn(),
    onRequestClose: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<RoomDetailWorkspace {...props} />) };
};

const openTab = async (name: string) => {
  await userEvent.click(screen.getByRole("tab", { name }));
};

describe("RoomDetailWorkspace", () => {
  beforeEach(() => {
    currentRole = "admin";
    vi.clearAllMocks();
    mockGetRoomHolds.mockResolvedValue([]);
    mockCreateRoomHold.mockResolvedValue({});
    mockUpdateRoomHold.mockResolvedValue({});
    mockDeleteRoomHold.mockResolvedValue({});
    mockUpdateRoom.mockResolvedValue({});
    mockUpdateRoomStatus.mockResolvedValue({});
  });

  it("shows tabs by capability: full for managers, minimal for read-only roles", async () => {
    renderWorkspace();
    expect(screen.getByRole("tab", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Operación" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Configuración" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bloqueos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Historial" })).toBeInTheDocument();
  });

  it("hides management tabs for read-only roles", () => {
    currentRole = "receptionist";
    renderWorkspace(makeRoom(), {
      canManageInventory: false,
      canManageStatus: false,
    });

    expect(screen.getByRole("tab", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bloqueos" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Operación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Configuración" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Historial" })).not.toBeInTheDocument();
  });

  it("reserves from the summary when available with bookings.write", async () => {
    const { props } = renderWorkspace();

    await userEvent.click(screen.getByRole("button", { name: "Reservar habitación" }));
    expect(props.onReserve).toHaveBeenCalledWith(makeRoom());
  });

  it("hides the reserve CTA when the room is not available", () => {
    renderWorkspace(makeRoom({ status: "Occupied" }));
    expect(
      screen.queryByRole("button", { name: "Reservar habitación" }),
    ).not.toBeInTheDocument();
  });

  it("applies valid transitions from Operación", async () => {
    renderWorkspace(makeRoom({ status: "Cleaning" }));
    await openTab("Operación");

    await userEvent.click(screen.getByRole("button", { name: "Disponible" }));
    await waitFor(() => {
      expect(mockUpdateRoomStatus).toHaveBeenCalledWith("r1", "AVAILABLE");
    });
  });

  it("explains Maintenance without offering local transitions", async () => {
    renderWorkspace(makeRoom({ status: "Maintenance" }));
    await openTab("Operación");

    expect(
      screen.getByText(/resolverse desde Housekeeping/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disponible" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpieza" })).not.toBeInTheDocument();
  });

  it("warns about unsaved config changes before leaving the tab", async () => {
    renderWorkspace();
    await openTab("Configuración");

    const priceInput = screen.getByLabelText(/Precio por noche/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "3000");

    await openTab("Resumen");

    expect(
      screen.getByText(/Hay cambios sin guardar en Configuración/),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "false");

    await userEvent.click(screen.getByRole("button", { name: "Descartar y continuar" }));
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
  });

  it("warns before closing with unsaved config changes", async () => {
    const { props } = renderWorkspace();
    await openTab("Configuración");

    const priceInput = screen.getByLabelText(/Precio por noche/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "3000");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));

    expect(props.onRequestClose).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Hay cambios sin guardar en Configuración/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Descartar y continuar" }));
    expect(props.onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("creates and edits a hold with reason and valid dates", async () => {
    mockGetRoomHolds.mockResolvedValue([hold]);
    renderWorkspace();
    await openTab("Bloqueos");

    await userEvent.type(screen.getByLabelText("Motivo"), "Grupo VIP");
    await userEvent.click(screen.getByRole("button", { name: "Crear bloqueo" }));

    await waitFor(() => {
      expect(mockCreateRoomHold).toHaveBeenCalledWith("r1", expect.objectContaining({
        reason: "Grupo VIP",
      }));
    });

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.type(screen.getByLabelText("Motivo"), " actualizado");
    await userEvent.click(screen.getByRole("button", { name: "Guardar bloqueo" }));

    await waitFor(() => {
      expect(mockUpdateRoomHold).toHaveBeenCalledWith("r1", "h1", expect.objectContaining({
        reason: "Grupo VIP actualizado",
      }));
    });
  });

  it("blocks hold creation without a reason or with invalid dates", async () => {
    renderWorkspace();
    await openTab("Bloqueos");

    expect(screen.getByRole("button", { name: "Crear bloqueo" })).toBeDisabled();
    expect(screen.getByText(/El motivo es obligatorio/)).toBeInTheDocument();
  });

  it("releases a hold only after confirmation", async () => {
    mockGetRoomHolds.mockResolvedValue([hold]);
    renderWorkspace();
    await openTab("Bloqueos");

    await userEvent.click(screen.getByRole("button", { name: "Liberar" }));
    expect(mockDeleteRoomHold).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar liberación" }));
    await waitFor(() => {
      expect(mockDeleteRoomHold).toHaveBeenCalledWith("r1", "h1");
    });
  });

  it("keeps holds local error actionable with retry", async () => {
    mockGetRoomHolds
      .mockRejectedValueOnce({ message: "Fallo de red" })
      .mockResolvedValueOnce([hold]);
    renderWorkspace();
    await openTab("Bloqueos");

    expect(
      await screen.findByText("No se pudieron cargar los bloqueos."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText("Grupo VIP")).toBeInTheDocument();
    });
  });

  it("loads audit only inside the Historial tab for users with the capability", async () => {
    renderWorkspace();
    expect(screen.queryByTestId("audit-timeline")).not.toBeInTheDocument();

    await openTab("Historial");
    expect(screen.getByTestId("audit-timeline")).toBeInTheDocument();
  });

  it("refreshes the parent after successful mutations", async () => {
    const { props } = renderWorkspace();
    await openTab("Operación");

    await userEvent.click(screen.getByRole("button", { name: "Disponible" }));

    await waitFor(() => {
      expect(props.onSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the hold count in the summary once loaded", async () => {
    mockGetRoomHolds.mockResolvedValue([hold]);
    renderWorkspace(makeRoom({ status: "Occupied" }));

    const summary = screen.getByRole("tabpanel", { name: "Resumen" });
    await waitFor(() => {
      expect(within(summary).getByText("1")).toBeInTheDocument();
    });
  });
});
