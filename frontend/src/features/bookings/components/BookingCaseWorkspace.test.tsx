import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Booking } from "@/types/domain";
import BookingCaseWorkspace from "./BookingCaseWorkspace";

const { useGuidedModeMock } = vi.hoisted(() => ({
  useGuidedModeMock: vi.fn(),
}));

const mockController = vi.fn();
vi.mock("@/features/bookings/components/useBookingDetailsController", () => ({
  useBookingDetailsController: (args: unknown) => mockController(args),
}));

vi.mock("@/components/ui/sheet", () => ({
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/features/bookings/components/BookingDetailsSections", () => ({
  BookingAccountSection: () => <div data-testid="booking-account-section" />,
  BookingCheckInSection: () => <div data-testid="booking-check-in-section" />,
  BookingCheckOutSection: () => <div data-testid="booking-check-out-section" />,
  BookingGuestStaySection: () => <div data-testid="booking-guest-stay-section" />,
  BookingReassignmentSection: () => <div data-testid="booking-reassignment-section" />,
  BookingSummaryMetrics: () => <div data-testid="booking-summary-metrics" />,
}));

vi.mock("@/features/guided/GuidedModeContext", () => ({
  useGuidedMode: () => useGuidedModeMock(),
}));

vi.mock("@/features/audit/components/AuditTimeline", () => ({
  default: () => <div data-testid="audit-timeline" />,
}));

const booking: Booking = {
  id: "booking-1",
  hotel_id: "hotel-1",
  room_id: "room-1",
  guest_id: null,
  guest_name: "Juan Perez",
  check_in: "2026-03-01",
  check_out: "2026-03-03",
  total_price_cents: 20_000,
  status: "Confirmed",
  operational_data: {},
};

const controllerDefaults = {
  bookingState: booking,
  room: { room_number: "101" },
  roomOptions: [],
  extraCharges: [],
  invoice: null,
  payments: [],
  loading: false,
  loadingCharges: false,
  statusLoading: null,
  roomOptionsLoading: false,
  reassignmentLoading: false,
  auditRefreshTick: 0,
  settlementLoading: false,
  selectedRoomId: "",
  reassignmentReason: "",
  paymentMethod: "",
  paymentAmount: "",
  paymentReference: "",
  paymentNote: "",
  checkInForm: {},
  checkOutForm: {},
  nights: 2,
  extrasTotal: 0,
  accommodationTotal: 20_000,
  outstandingAmountCents: 0,
  statusMeta: { icon: () => <span />, label: "Confirmada", badge: "bg-primary/10 text-primary" },
  canManageRoomException: false,
  canViewAudit: false,
  canOverrideCheckoutBalance: false,
  checkInBlockers: [],
  canCompleteFormalCheckIn: true,
  checkoutBlockers: [],
  canCompleteFormalCheckOut: false,
  nextAction: { title: "Lista para check-in", description: "La reserva ya validó los controles." },
  reassignmentBlockers: [],
  warningBanner: null,
  footerRoom: null,
  quickCharges: [],
  setSelectedRoomId: vi.fn(),
  setReassignmentReason: vi.fn(),
  setPaymentMethod: vi.fn(),
  setPaymentAmount: vi.fn(),
  setPaymentReference: vi.fn(),
  setPaymentNote: vi.fn(),
  updateCheckInForm: vi.fn(),
  updateCheckOutForm: vi.fn(),
  refreshOperationalData: vi.fn(),
  handleRegisterPayment: vi.fn(),
  handleRoomReassignment: vi.fn(),
  handleQuickCharge: vi.fn(),
  handleStatusAction: vi.fn(),
};

const guidedModeDefault = {
  enabled: true,
  getReceptionGuideState: () => ({
    steps: [],
    summary: {
      title: "Recepción guiada",
      description: "Seguí el próximo paso recomendado para completar el flujo del turno.",
    },
  }),
  trackReceptionEvent: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockController.mockReturnValue(controllerDefaults);
  useGuidedModeMock.mockReturnValue(guidedModeDefault);
  Element.prototype.scrollIntoView = vi.fn();
});

const renderWorkspace = (props: Partial<Parameters<typeof BookingCaseWorkspace>[0]> = {}) =>
  render(<BookingCaseWorkspace booking={booking} isOpen onClose={vi.fn()} {...props} />);

describe("BookingCaseWorkspace", () => {
  it("renders nothing while there is no booking state", () => {
    mockController.mockReturnValue({ ...controllerDefaults, bookingState: null });
    renderWorkspace();

    expect(screen.queryByText(/Juan Perez/i)).toBeNull();
  });

  it("renders the next action for the current booking status", () => {
    renderWorkspace();

    expect(screen.getAllByText("Lista para check-in").length).toBeGreaterThan(0);
  });

  it("shows the four case tabs and switches between panels", () => {
    renderWorkspace();

    expect(screen.getByRole("tab", { name: /Resumen/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Operación/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Cuenta/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Historial/i })).toBeDefined();
    expect(screen.getByTestId("booking-summary-metrics")).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: /Operación/i }));

    expect(screen.getByTestId("booking-check-in-section")).toBeDefined();
    expect(
      screen.getByTestId("booking-summary-metrics").closest('[role="tabpanel"]'),
    ).toHaveAttribute("hidden");
  });

  it("shows the pending control badge on the operation tab", () => {
    mockController.mockReturnValue({ ...controllerDefaults, checkInBlockers: [{ id: "id-1" }, { id: "id-2" }] });

    renderWorkspace();

    expect(screen.getByRole("tab", { name: /Operación 2/i })).toBeDefined();
  });

  it("only shows the reassignment section for users allowed to manage room exceptions", () => {
    const first = renderWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: /Operación/i }));
    expect(screen.queryByTestId("booking-reassignment-section")).toBeNull();
    first.unmount();

    mockController.mockReturnValue({
      ...controllerDefaults,
      canManageRoomException: true,
      bookingState: { ...booking, status: "CheckedIn" },
      checkoutBlockers: [],
      canCompleteFormalCheckOut: false,
      outstandingAmountCents: 0,
    });
    renderWorkspace({ booking: { ...booking, status: "CheckedIn" } });
    fireEvent.click(screen.getByRole("tab", { name: /Operación/i }));
    expect(screen.getByTestId("booking-reassignment-section")).toBeDefined();
  });

  it("moves focus to the guided target after mount without mutating", async () => {
    renderWorkspace({ guidedFocusStep: "check-in" });

    expect(controllerDefaults.handleStatusAction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("reception-guide-check-in");
    });
  });

  it("navigates via the guided CTA without executing the transition", async () => {
    renderWorkspace({ guidedFocusStep: "check-in" });

    fireEvent.click(screen.getByRole("button", { name: /Ir al checklist de llegada/i }));

    expect(controllerDefaults.handleStatusAction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("reception-guide-check-in");
    });
  });

  it("runs the status action from the sticky CTA and tracks the guided event", async () => {
    const trackReceptionEvent = vi.fn();
    useGuidedModeMock.mockReturnValue({
      ...guidedModeDefault,
      trackReceptionEvent,
    });
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /Registrar check-in/i }));

    await waitFor(() => {
      expect(controllerDefaults.handleStatusAction).toHaveBeenCalledWith("CheckedIn", undefined);
      expect(trackReceptionEvent).toHaveBeenCalledWith("checkin_complete");
    });
  });

  it("navigates to the operation checklist when the case is not ready for check-in", () => {
    mockController.mockReturnValue({ ...controllerDefaults, canCompleteFormalCheckIn: false });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /Completar checklist de llegada/i }));

    expect(controllerDefaults.handleStatusAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("booking-check-in-section")).toBeDefined();
  });

  it("opens the account tab from the sticky CTA when there is an outstanding balance", () => {
    mockController.mockReturnValue({
      ...controllerDefaults,
      bookingState: { ...booking, status: "CheckedIn" },
      outstandingAmountCents: 5_000,
      checkoutBlockers: [],
    });

    renderWorkspace({ booking: { ...booking, status: "CheckedIn" } });

    fireEvent.click(screen.getByRole("button", { name: /Registrar cobro/i }));

    expect(screen.getByTestId("booking-account-section")).toBeDefined();
    expect(controllerDefaults.handleStatusAction).not.toHaveBeenCalled();
  });

  it("registers checkout from the sticky CTA when the case is ready", async () => {
    const trackReceptionEvent = vi.fn();
    useGuidedModeMock.mockReturnValue({
      ...guidedModeDefault,
      trackReceptionEvent,
    });
    mockController.mockReturnValue({
      ...controllerDefaults,
      bookingState: { ...booking, status: "CheckedIn" },
      outstandingAmountCents: 0,
      canCompleteFormalCheckOut: true,
    });

    renderWorkspace({ booking: { ...booking, status: "CheckedIn" } });

    fireEvent.click(screen.getByRole("button", { name: /Registrar checkout/i }));

    await waitFor(() => {
      expect(controllerDefaults.handleStatusAction).toHaveBeenCalledWith("CheckedOut", undefined);
      expect(trackReceptionEvent).toHaveBeenCalledWith("checkout_complete");
    });
  });

  it("keeps the audit panel behind the history tab and only with permission", () => {
    const first = renderWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: /Historial/i }));
    expect(screen.queryByTestId("audit-timeline")).toBeNull();
    expect(screen.getByText(/No tenés permisos para ver la auditoría/i)).toBeDefined();
    first.unmount();

    mockController.mockReturnValue({ ...controllerDefaults, canViewAudit: true });
    renderWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: /Historial/i }));
    expect(screen.getByTestId("audit-timeline")).toBeDefined();
  });

  it("shows a closed case with and without a next case in the queue", () => {
    mockController.mockReturnValue({
      ...controllerDefaults,
      bookingState: { ...booking, status: "CheckedOut" },
      nextAction: { title: "Estadía cerrada", description: "La reserva ya terminó." },
    });
    const onOpenQueuedBooking = vi.fn();
    renderWorkspace({
      booking: { ...booking, status: "CheckedOut" },
      queueBookingIds: ["booking-1", "booking-2"],
      onOpenQueuedBooking,
    });

    const nextButton = screen.getByRole("button", { name: /Continuar con siguiente caso/i });
    expect(nextButton).toBeDefined();
    fireEvent.click(nextButton);
    expect(onOpenQueuedBooking).toHaveBeenCalledWith("booking-2");
  });

  it("keeps the turn queue context with previous and next case navigation", () => {
    const onOpenQueuedBooking = vi.fn();
    renderWorkspace({
      queueBookingIds: ["booking-1", "booking-2", "booking-3"],
      onOpenQueuedBooking,
    });

    expect(screen.getByText(/Caso 1 de 3/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Continuar con siguiente/i }));
    expect(onOpenQueuedBooking).toHaveBeenCalledWith("booking-2");
  });
});
