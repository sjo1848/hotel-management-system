import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingCheckInSection } from "./BookingCheckInSection";

const baseForm = {
  documentVerified: false,
  stayConfirmed: false,
  contactConfirmed: false,
  guestsCount: "1",
  arrivalReference: "",
};

describe("BookingCheckInSection mobile flow", () => {
  it("requires verification before advancing and exposes the sequential stages", () => {
    const onFormChange = vi.fn();
    render(
      <BookingCheckInSection
        form={baseForm}
        checkInBlockers={[]}
        canCompleteFormalCheckIn={true}
        statusLoading={null}
        onFormChange={onFormChange}
        onStatusAction={vi.fn()}
        roomLabel="Habitación 12"
      />,
    );

    expect(screen.getByText(/Paso 1 de 4: Verificación/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Siguiente/i })).toBeDisabled();

    fireEvent.click(screen.getAllByLabelText(/Identidad validada/i)[0]);
    fireEvent.click(screen.getAllByLabelText(/Fechas y tarifa confirmadas/i)[0]);
    fireEvent.click(screen.getAllByLabelText(/Contacto verificado/i)[0]);
    expect(onFormChange).toHaveBeenCalledTimes(3);
  });

  it("keeps inactive stages out of the active mobile surface and reaches confirmation", () => {
    const onStatusAction = vi.fn();
    const form = { ...baseForm, documentVerified: true, stayConfirmed: true, contactConfirmed: true };
    render(
      <BookingCheckInSection
        form={form}
        checkInBlockers={[]}
        canCompleteFormalCheckIn={true}
        statusLoading={null}
        onFormChange={vi.fn()}
        onStatusAction={onStatusAction}
        roomLabel="Habitación 12"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

    expect(screen.getByText(/Paso 4 de 4: Confirmar ingreso/i)).toBeDefined();
    expect(screen.getByText(/Habitación 12 · 1 huésped/i)).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Confirmar ingreso/i })[0]).toBeDefined();
    fireEvent.click(screen.getAllByRole("button", { name: /Confirmar ingreso/i })[0]);
    expect(onStatusAction).toHaveBeenCalledWith("CheckedIn");
  });
});
