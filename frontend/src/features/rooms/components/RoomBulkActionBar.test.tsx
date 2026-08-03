import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/types/domain";
import { RoomBulkActionBar, type RoomBulkActionBarProps } from "./RoomBulkActionBar";

const makeRoom = (id: string, status: Room["status"]): Room => ({
  id,
  hotel_id: "h",
  room_number: id,
  room_type: "DOUBLE",
  status,
  price_cents: 250000,
});

const renderBar = (
  rooms: Room[],
  overrides: Partial<RoomBulkActionBarProps> = {},
) => {
  const props: RoomBulkActionBarProps = {
    selectedRooms: rooms,
    outOfFilterCount: 0,
    allVisibleSelected: false,
    visibleCount: rooms.length,
    busy: null,
    onApply: vi.fn(),
    onSelectVisible: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<RoomBulkActionBar {...props} />) };
};

describe("RoomBulkActionBar matrix", () => {
  it("allows Cleaning -> Available and confirms before applying", async () => {
    const { props } = renderBar([makeRoom("101", "Cleaning")]);

    const button = screen.getByRole("button", { name: "Marcar disponibles" });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    expect(
      screen.getByText(/¿Aplicar «Marcar disponibles» a 1 habitaciones\?/),
    ).toBeInTheDocument();
    expect(props.onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(props.onApply).toHaveBeenCalledWith("AVAILABLE");
  });

  it("allows Available -> Available as a no-op target", () => {
    renderBar([makeRoom("101", "Available")]);
    expect(screen.getByRole("button", { name: "Marcar disponibles" })).toBeEnabled();
  });

  it("allows Occupied -> Dirty", () => {
    renderBar([makeRoom("101", "Occupied")]);
    expect(screen.getByRole("button", { name: "Enviar a limpieza" })).toBeEnabled();
  });

  it("allows Dirty -> Dirty as a no-op target", () => {
    renderBar([makeRoom("101", "Dirty")]);
    expect(screen.getByRole("button", { name: "Enviar a limpieza" })).toBeEnabled();
  });

  it("blocks Occupied from Marcar disponibles and explains why", () => {
    renderBar([makeRoom("101", "Occupied")]);
    const button = screen.getByRole("button", { name: "Marcar disponibles" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Bloquean: Ocupadas/)).toBeInTheDocument();
  });

  it("blocks Cleaning from Enviar a limpieza", () => {
    renderBar([makeRoom("101", "Cleaning")]);
    expect(screen.getByRole("button", { name: "Enviar a limpieza" })).toBeDisabled();
  });

  it("blocks both actions when Maintenance is selected", () => {
    renderBar([makeRoom("101", "Maintenance")]);
    expect(screen.getByRole("button", { name: "Marcar disponibles" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar a limpieza" })).toBeDisabled();
    expect(screen.getByText(/Bloquean: Mantenimiento/)).toBeInTheDocument();
  });

  it("blocks a mixed batch and lists every blocking status", () => {
    renderBar([
      makeRoom("101", "Cleaning"),
      makeRoom("102", "Occupied"),
      makeRoom("103", "Maintenance"),
    ]);
    expect(screen.getByRole("button", { name: "Marcar disponibles" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar a limpieza" })).toBeDisabled();
    expect(
      screen.getByText(/Bloquean: Ocupadas · Mantenimiento/),
    ).toBeInTheDocument();
  });

  it("cancels the confirmation without applying", async () => {
    const { props } = renderBar([makeRoom("101", "Cleaning")]);

    await userEvent.click(screen.getByRole("button", { name: "Marcar disponibles" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(props.onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Marcar disponibles" })).toBeEnabled();
  });

  it("prevents double submit while busy", async () => {
    const { props, user, rerender } = renderBar([makeRoom("101", "Cleaning")]);

    await user.click(screen.getByRole("button", { name: "Marcar disponibles" }));
    props.busy = "AVAILABLE";
    rerender(<RoomBulkActionBar {...props} />);

    await user.click(screen.getByRole("button", { name: "Aplicando..." }));
    expect(props.onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Aplicando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("applies and keeps the selection visible on the same batch", async () => {
    const { props } = renderBar([makeRoom("101", "Cleaning")]);

    await userEvent.click(screen.getByRole("button", { name: "Marcar disponibles" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 habitaciones seleccionadas")).toBeInTheDocument();
  });

  it("keeps the selection when an error is reported by the caller", async () => {
    const { props } = renderBar([makeRoom("101", "Cleaning")], { busy: null });

    await userEvent.click(screen.getByRole("button", { name: "Marcar disponibles" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(props.onApply).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText("1 habitaciones seleccionadas")).toBeInTheDocument();
    });
  });

  it("shows out-of-filter selection and selects visible rooms only", async () => {
    const { props } = renderBar(
      [makeRoom("101", "Cleaning"), makeRoom("102", "Cleaning")],
      { outOfFilterCount: 1, visibleCount: 2, allVisibleSelected: false },
    );

    expect(screen.getByText("1 fuera del filtro")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Seleccionar visibles (2)" }));
    expect(props.onSelectVisible).toHaveBeenCalledTimes(1);
  });

  it("clears the selection", async () => {
    const { props } = renderBar([makeRoom("101", "Cleaning")]);
    await userEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
