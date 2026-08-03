import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GuideHint from "./GuideHint";

describe("GuideHint", () => {
  it("announces the next recommended step with aria-live", () => {
    render(
      <GuideHint
        title="Registrá la llegada"
        description="Completá el check-in formal."
        ctaLabel="Ir al check-in"
        onCta={vi.fn()}
      />,
    );

    expect(screen.getByText(/Siguiente paso recomendado/i)).toBeDefined();
    expect(screen.getByText(/Registrá la llegada/i)).toBeDefined();
    expect(screen.getByText(/Completá el check-in formal/i)).toBeDefined();
    expect(screen.getByText(/Ir al check-in/i)).toBeDefined();
    expect(screen.getByText(/Siguiente paso recomendado/i).closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
  });

  it("renders without CTA when no action applies", () => {
    render(<GuideHint title="Turno bajo control" description="Sin pasos pendientes." />);

    expect(screen.getByText(/Turno bajo control/i)).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("navigates via CTA without executing the critical transition", () => {
    const onCta = vi.fn();
    render(
      <GuideHint title="Cerrá la cuenta" description="Dejá la cuenta clara." ctaLabel="Ir a la cuenta" onCta={onCta} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ir a la cuenta/i }));

    expect(onCta).toHaveBeenCalledTimes(1);
  });
});
