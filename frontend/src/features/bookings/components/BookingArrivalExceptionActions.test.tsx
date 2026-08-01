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
  it("requires evidence and submits late arrival or no-show explicitly", () => {
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
    expect(onAction).toHaveBeenCalledWith("NoShow", {
      terminal_reason: "Sin contacto al horario acordado",
    });

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
