import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types/domain";
import BookingArrivalExceptionActions from "./BookingArrivalExceptionActions";

const isoDate = (offsetDays: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const booking: Booking = {
  id: "booking-1",
  hotel_id: "hotel-1",
  room_id: "room-1",
  guest_id: null,
  guest_name: "Huésped demorado",
  check_in: isoDate(0),
  check_out: isoDate(2),
  total_price_cents: 20_000,
  status: "Confirmed",
  operational_data: {},
};

describe("BookingArrivalExceptionActions", () => {
  it("requires a reason before opening the confirmation and submits no-show only after explicit confirmation", () => {
    const onAction = vi.fn();
    render(
      <BookingArrivalExceptionActions
        booking={booking}
        statusLoading={null}
        onAction={onAction}
      />,
    );

    const noShowButton = screen.getByRole("button", { name: /Marcar no-show/i });
    expect(noShowButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo terminal/i), {
      target: { value: "Sin contacto al horario acordado" },
    });
    expect(noShowButton).toBeEnabled();

    fireEvent.click(noShowButton);
    expect(onAction).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Vas a registrar un no-show/i),
    ).toBeDefined();
    expect(screen.getByText(/Motivo: Sin contacto al horario acordado/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar no-show/i }));
    expect(onAction).toHaveBeenCalledWith("NoShow", {
      terminal_reason: "Sin contacto al horario acordado",
    });
  });

  it("keeps the typed reason when opening the confirmation and allows going back without executing", () => {
    const onAction = vi.fn();
    render(
      <BookingArrivalExceptionActions
        booking={booking}
        statusLoading={null}
        onAction={onAction}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Motivo terminal/i), {
      target: { value: "Cliente no responde a contactos" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar reserva/i }));
    expect(screen.getByText(/Vas a cancelar esta reserva/i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Volver/i }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByText(/Vas a cancelar esta reserva/i)).toBeNull();
    expect(screen.getByLabelText(/Motivo terminal/i)).toHaveValue("Cliente no responde a contactos");
  });

  it("does not double-submit while a terminal status is loading", () => {
    const onAction = vi.fn();
    render(
      <BookingArrivalExceptionActions
        booking={booking}
        statusLoading="NoShow"
        onAction={onAction}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Motivo terminal/i), {
      target: { value: "Sin respuesta en horario de llegada" },
    });
    expect(screen.getByRole("button", { name: /Marcar no-show/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Registrar llegada tardía/i })).toBeDisabled();
  });

  it("requires future ETA evidence to submit a late arrival", () => {
    const onAction = vi.fn();
    render(
      <BookingArrivalExceptionActions
        booking={booking}
        statusLoading={null}
        onAction={onAction}
      />,
    );
    const localEta = new Date(Date.now() + 60 * 60 * 1000);
    const offset = localEta.getTimezoneOffset() * 60_000;
    const localEtaInput = new Date(localEta.getTime() - offset).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText(/Nueva ETA/i), {
      target: { value: localEtaInput },
    });
    fireEvent.change(screen.getByLabelText(/Nota de llegada tardía/i), {
      target: { value: "Vuelo demorado, arribo confirmado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registrar llegada tardía/i }));
    expect(onAction).toHaveBeenLastCalledWith("Confirmed", {
      late_arrival_eta: new Date(localEtaInput).toISOString().slice(0, 19),
      late_arrival_note: "Vuelo demorado, arribo confirmado",
    });
  });

  it("keeps no-show disabled before the arrival date", () => {
    render(
      <BookingArrivalExceptionActions
        booking={{ ...booking, check_in: isoDate(1), check_out: isoDate(3) }}
        statusLoading={null}
        onAction={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Motivo terminal/i), {
      target: { value: "No se presento en recepcion" },
    });
    expect(screen.getByRole("button", { name: /Marcar no-show/i })).toBeDisabled();
  });
});
