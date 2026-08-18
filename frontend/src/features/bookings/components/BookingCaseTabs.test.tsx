import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { BookingCaseTabs, type BookingCaseTab } from "./BookingCaseTabs";

const content = {
  summary: <div>summary surface</div>,
  operation: <div>operation surface</div>,
  account: <div>account surface</div>,
  history: <div>history surface</div>,
};

describe("BookingCaseTabs", () => {
  it("mounts only the active case surface", () => {
    render(
      <BookingCaseTabs
        {...content}
        activeTab="summary"
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByText("summary surface")).toBeDefined();
    expect(screen.queryByText("history surface")).toBeNull();
  });

  it("keeps a visited task mounted when returning to the summary", () => {
    const StatefulOperation = () => {
      const [value, setValue] = useState("");
      return <input aria-label="operation draft" value={value} onChange={(event) => setValue(event.target.value)} />;
    };
    const props = { ...content, operation: <StatefulOperation />, onTabChange: vi.fn() };
    const { rerender } = render(<BookingCaseTabs {...props} activeTab="operation" />);
    fireEvent.change(screen.getByRole("textbox", { name: "operation draft" }), { target: { value: "draft" } });

    rerender(<BookingCaseTabs {...props} activeTab="summary" />);
    expect(screen.getByRole("textbox", { name: "operation draft", hidden: true })).toHaveValue("draft");

    rerender(<BookingCaseTabs {...props} activeTab="operation" />);
    expect(screen.getByRole("textbox", { name: "operation draft" })).toHaveValue("draft");
  });

  it("replaces mobile tabs with a task exit while an operation is active", () => {
    const onTabChange = vi.fn();
    render(
      <BookingCaseTabs
        {...content}
        activeTab="operation"
        mobileTaskMode
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByText("operation surface")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /volver al caso/i }));
    expect(onTabChange).toHaveBeenCalledWith("summary");
  });

  it("moves focus to the summary surface when leaving a mobile task", async () => {
    const ControlledTabs = () => {
      const [activeTab, setActiveTab] = useState<BookingCaseTab>("operation");
      return (
        <BookingCaseTabs
          {...content}
          activeTab={activeTab}
          mobileTaskMode={activeTab === "operation"}
          onTabChange={setActiveTab}
        />
      );
    };
    render(<ControlledTabs />);
    fireEvent.click(screen.getByRole("button", { name: /volver al caso/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
    });
  });
});
