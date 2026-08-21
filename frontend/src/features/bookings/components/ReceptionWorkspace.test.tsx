import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReceptionWorkspace } from "./ReceptionWorkspace";

const counts = {
  shift: 1,
  arrivals: 2,
  "in-house": 3,
  departures: 4,
  reservations: 5,
} as const;

describe("ReceptionWorkspace", () => {
  it("mounts operational surfaces on demand and preserves visited state", () => {
    const StatefulShift = () => {
      const [value, setValue] = useState("");
      return <input aria-label="shift filter" value={value} onChange={(event) => setValue(event.target.value)} />;
    };
    const props = {
      onViewChange: vi.fn(),
      counts,
      shiftView: <StatefulShift />,
      arrivalsView: <div>arrivals surface</div>,
      inHouseView: <div>in-house surface</div>,
      departuresView: <div>departures surface</div>,
      reservationsView: <div>reservations surface</div>,
    };
    const { rerender } = render(<ReceptionWorkspace {...props} view="shift" />);

    fireEvent.change(screen.getByRole("textbox", { name: "shift filter" }), { target: { value: "Juan" } });
    expect(screen.queryByText("reservations surface")).toBeNull();

    rerender(<ReceptionWorkspace {...props} view="reservations" />);
    expect(screen.getByText("reservations surface")).toBeDefined();
    expect(screen.getByRole("textbox", { name: "shift filter", hidden: true })).toHaveValue("Juan");

    rerender(<ReceptionWorkspace {...props} view="shift" />);
    expect(screen.getByRole("textbox", { name: "shift filter" })).toHaveValue("Juan");
  });
});
