import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HousekeepingBoardRoom } from "@/types/domain";
import MaintenanceCaseActions from "./MaintenanceCaseActions";

const room: HousekeepingBoardRoom = {
  room_id: "room-1",
  room_number: "101",
  room_type: "Standard",
  room_status: "Dirty",
  turnover_today: true,
};

describe("MaintenanceCaseActions", () => {
  it("requires evidence and opens an owned prioritized case", () => {
    const onOpen = vi.fn();
    render(
      <MaintenanceCaseActions
        room={room}
        loading={false}
        onOpen={onOpen}
        onResolve={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir incidencia/i }));
    const submit = screen.getByRole("button", { name: /Crear caso y bloquear/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Pérdida de agua en el baño" },
    });
    fireEvent.change(screen.getByLabelText("Prioridad"), { target: { value: "URGENT" } });
    fireEvent.change(screen.getByLabelText("Responsable"), {
      target: { value: "Equipo técnico" },
    });
    fireEvent.click(submit);
    expect(onOpen).toHaveBeenCalledWith({
      reason: "Pérdida de agua en el baño",
      priority: "URGENT",
      assigned_to: "Equipo técnico",
    });
  });

  it("shows the active case and requires a resolution note", () => {
    const onResolve = vi.fn();
    render(
      <MaintenanceCaseActions
        room={{
          ...room,
          room_status: "Maintenance",
          maintenance_case: {
            id: "case-12345678",
            hotel_id: "hotel-1",
            room_id: room.room_id,
            status: "Open",
            priority: "High",
            reason: "Aire acondicionado fuera de servicio",
            assigned_to: "ops",
            reported_by_user_id: "user-1",
            reported_at: "2026-08-01T10:00:00",
          },
        }}
        loading={false}
        onOpen={vi.fn()}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByText(/Caso case-123/i)).toBeInTheDocument();
    const resolve = screen.getByRole("button", { name: /Resolver y volver a Dirty/i });
    expect(resolve).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Resolución realizada/i), {
      target: { value: "Equipo reparado y verificado" },
    });
    fireEvent.click(resolve);
    expect(onResolve).toHaveBeenCalledWith({
      resolution_note: "Equipo reparado y verificado",
    });
  });
});
