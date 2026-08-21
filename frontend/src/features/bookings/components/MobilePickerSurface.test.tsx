import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { MobilePickerSurface } from "./MobilePickerSurface";

describe("MobilePickerSurface", () => {
  it("has an explicit accessible close action and focuses a visible desktop target when crossing 768px", async () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    const pickerRoot = document.createElement("div");
    pickerRoot.id = "walk-in-mobile-picker-root";
    document.body.appendChild(trigger);
    document.body.appendChild(pickerRoot);
    const initialFocusRef = createRef<HTMLInputElement>();
    const desktopFocusRef = { current: null as HTMLInputElement | null };
    const listeners: Array<(event: MediaQueryListEvent) => void> = [];
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(min-width: 768px)",
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    render(
      <MobilePickerSurface
        open
        title="Seleccionar huésped"
        description="Buscá un huésped"
        titleId="mobile-guest-picker-title"
        initialFocusRef={initialFocusRef}
        desktopFocusRef={desktopFocusRef}
        onClose={onClose}
      >
        <input ref={initialFocusRef} aria-label="Buscar huésped" />
      </MobilePickerSurface>,
    );
    const desktopTarget = document.createElement("input");
    desktopTarget.setAttribute("aria-label", "Buscar huésped en desktop");
    document.body.appendChild(desktopTarget);
    desktopFocusRef.current = desktopTarget;

    expect(screen.getByRole("region", { name: "Seleccionar huésped" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cerrar seleccionar huésped" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar seleccionar huésped" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    expect(onClose).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(document.activeElement).toBe(desktopTarget));

    window.matchMedia = originalMatchMedia;
    trigger.remove();
    desktopTarget.remove();
    pickerRoot.remove();
  });
});
