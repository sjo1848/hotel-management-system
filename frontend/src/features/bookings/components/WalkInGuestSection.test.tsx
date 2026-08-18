import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkInGuestSection } from "./WalkInGuestSection";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.getElementById("walk-in-mobile-picker-root")?.remove();
});

describe("WalkInGuestSection", () => {
  it("focuses the real desktop guest search after an open picker crosses 768px", async () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = [];
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(min-width: 768px)",
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    const pickerRoot = document.createElement("div");
    pickerRoot.id = "walk-in-mobile-picker-root";
    document.body.appendChild(pickerRoot);

    const Harness = () => {
      const [pickerOpen, setPickerOpen] = useState(true);
      return (
        <WalkInGuestSection
          guestMode="existing"
          guestSearch=""
          selectedGuestId={null}
          selectedGuest={null}
          filteredGuests={[]}
          guestsLoading={false}
          newGuest={{ full_name: "", email: "", phone: "" }}
          onGuestModeChange={vi.fn()}
          onGuestSearchChange={vi.fn()}
          onRefreshGuests={vi.fn()}
          onSelectGuest={vi.fn()}
          onNewGuestChange={vi.fn()}
          guestPickerOpen={pickerOpen}
          onGuestPickerOpenChange={setPickerOpen}
        />
      );
    };

    render(<Harness />);
    const desktopSearch = screen.getByRole("textbox", { name: "Buscar huesped" });

    act(() => {
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    await waitFor(() => expect(document.activeElement).toBe(desktopSearch));
    expect(screen.queryByRole("region", { name: "Seleccionar huésped" })).toBeNull();
  });
});
