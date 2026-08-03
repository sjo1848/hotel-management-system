import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CompactGuideAssistant from "./CompactGuideAssistant";
import type { GuideStepView } from "@/features/guided/types";

const steps: GuideStepView[] = [
  {
    id: "review-case",
    label: "Revisar caso",
    helper: "Confirmá datos del huésped y bloqueos.",
    actionLabel: "Revisar caso",
    active: true,
    done: false,
  },
  {
    id: "check-in",
    label: "Registrar check-in",
    helper: "Completá el checklist de llegada.",
    actionLabel: "Ir al checklist",
    active: false,
    done: false,
  },
  {
    id: "payment",
    label: "Cobrar estadía",
    helper: "Registrá el pago en la cuenta.",
    actionLabel: "Ir a la cuenta",
    active: false,
    done: false,
  },
];

const defaultProps = {
  title: "Completar llegada",
  description: "Seguí el próximo paso recomendado para completar el flujo del turno.",
  completed: 1,
  total: 5,
  steps,
  ctaLabel: "Continuar",
  onCta: vi.fn(),
  onReset: vi.fn(),
  onStepSelect: vi.fn(),
};

const renderAssistant = (props: Partial<Parameters<typeof CompactGuideAssistant>[0]> = {}) =>
  render(<CompactGuideAssistant {...defaultProps} {...props} />);

describe("CompactGuideAssistant", () => {
  it("renders a single compact row with the active step, progress and CTA", () => {
    renderAssistant();

    expect(screen.getByText(/Siguiente: Revisar caso/i)).toBeDefined();
    expect(screen.getByText("1/5")).toBeDefined();
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Reiniciar/i })).toBeNull();
  });

  it("hides the CTA when there is no active mission", () => {
    renderAssistant({ steps: [], ctaLabel: undefined, onCta: undefined });

    expect(screen.queryByRole("button", { name: /Continuar/i })).toBeNull();
    expect(screen.getByText(/Siguiente: Completar llegada/i)).toBeDefined();
  });

  it("expands the mission panel with progress, steps and actions", () => {
    renderAssistant();

    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Revisar caso/i }));

    expect(screen.getByText(/Misión guiada/i)).toBeDefined();
    expect(screen.getByText("1/5 completado")).toBeDefined();
    expect(screen.getByRole("button", { name: /Reiniciar/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Contraer/i })).toBeDefined();
    expect(screen.getByText("Registrar check-in")).toBeDefined();
  });

  it("navigates on step click without resetting or marking progress", () => {
    const onStepSelect = vi.fn();
    const onReset = vi.fn();
    renderAssistant({ onStepSelect, onReset });

    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Revisar caso/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ir al checklist/i }));

    expect(onStepSelect).toHaveBeenCalledWith("check-in");
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByText("Ahora")).toBeDefined();
  });

  it("runs the CTA of the active step", () => {
    const onCta = vi.fn();
    renderAssistant({ onCta });

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    expect(onCta).toHaveBeenCalledOnce();
  });

  it("collapses the panel without disabling the guided mode", () => {
    renderAssistant();

    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Revisar caso/i }));
    fireEvent.click(screen.getByRole("button", { name: /Contraer/i }));

    expect(screen.queryByRole("button", { name: /Reiniciar/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Siguiente: Revisar caso/i })).toBeDefined();
  });

  it("resets the journey from the open panel", () => {
    const onReset = vi.fn();
    renderAssistant({ onReset });

    fireEvent.click(screen.getByRole("button", { name: /Siguiente: Revisar caso/i }));
    fireEvent.click(screen.getByRole("button", { name: /Reiniciar/i }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
