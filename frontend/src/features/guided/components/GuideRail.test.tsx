import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GuideRail from "./GuideRail";
import type { GuideStepView } from "@/features/guided/types";

const steps: GuideStepView[] = [
  {
    id: "open-case",
    label: "Abrí un caso del turno",
    helper: "Tomá una llegada lista para operar.",
    actionLabel: "Ir a la cola",
    done: false,
    active: true,
  },
  {
    id: "check-in",
    label: "Registrá la llegada",
    helper: "Completá el check-in formal.",
    actionLabel: "Ir al check-in",
    done: false,
    active: false,
  },
  {
    id: "checkout",
    label: "Finalizá la salida",
    helper: "Cerrá el checkout.",
    actionLabel: "Ir al checkout",
    done: true,
    active: false,
  },
];

describe("GuideRail", () => {
  const defaultProps = {
    title: "Recepción guiada",
    description: "Seguí el próximo paso recomendado.",
    completed: 1,
    total: 3,
    steps,
    enabled: true,
    onToggle: vi.fn(),
    onReset: vi.fn(),
    onStepSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders summary, progress and steps with status labels", () => {
    render(<GuideRail {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Recepción guiada/i })).toBeDefined();
    expect(screen.getByText(/1\/3 completado/i)).toBeDefined();
    expect(screen.getByText(/Abrí un caso del turno/i)).toBeDefined();
    expect(screen.getByText("Ahora")).toBeDefined();
    expect(screen.getByText("Pendiente")).toBeDefined();
    expect(screen.getByText("Completado")).toBeDefined();
  });

  it("marks only the active step with aria-current and shows navigation actions", () => {
    render(<GuideRail {...defaultProps} />);

    const activeCard = screen.getByRole("button", { name: /Abrí un caso del turno/i });
    const pendingCard = screen.getByRole("button", { name: /Registrá la llegada/i });

    expect(activeCard.getAttribute("aria-current")).toBe("step");
    expect(pendingCard.getAttribute("aria-current")).toBeNull();
    expect(screen.getByText(/Ir a la cola/i)).toBeDefined();
  });

  it("navigates on step click without completing the step", () => {
    render(<GuideRail {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Registrá la llegada/i }));

    expect(defaultProps.onStepSelect).toHaveBeenCalledTimes(1);
    expect(defaultProps.onStepSelect).toHaveBeenCalledWith("check-in");
  });

  it("toggles and resets the guided mode from the rail controls", () => {
    render(<GuideRail {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Ocultar guía/i }));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Reiniciar/i }));
    expect(defaultProps.onReset).toHaveBeenCalledTimes(1);
  });

  it("shows the enabled state label after toggling off", () => {
    render(<GuideRail {...defaultProps} enabled={false} />);

    expect(screen.getByRole("button", { name: /Activar guía/i })).toBeDefined();
  });

  it("invokes the CTA without auto-completing steps", () => {
    const onCta = vi.fn();
    render(<GuideRail {...defaultProps} ctaLabel="Ir a la cola de trabajo" onCta={onCta} />);

    fireEvent.click(screen.getByRole("button", { name: /Ir a la cola de trabajo/i }));

    expect(onCta).toHaveBeenCalledTimes(1);
    expect(defaultProps.onStepSelect).not.toHaveBeenCalled();
  });
});
