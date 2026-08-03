import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Booking } from "@/types/domain";
import BookingDetailsSheet from "./BookingDetailsSheet";

const mockController = vi.fn();
vi.mock("@/features/bookings/components/useBookingDetailsController", () => ({
  useBookingDetailsController: (args: unknown) => mockController(args),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: any) => <div>{children}</div>,
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
  BookingNextActionBanner: ({ onStatusAction }: any) => (
    <button type="button" onClick={() => onStatusAction("CheckedIn")}>
      Ejecutar siguiente accion
    </button>
  ),
  BookingReassignmentSection: () => <div data-testid="booking-reassignment-section" />,
  BookingSidebarPanels: () => <div data-testid="booking-sidebar-panels" />,
  BookingSummaryMetrics: () => <div data-testid="booking-summary-metrics" />,
}));

vi.mock("@/features/guided/GuidedModeContext", () => ({
  useGuidedMode: () => ({
    enabled: true,
    getReceptionGuideState: () => ({
      steps: [],
      summary: {
        title: "Recepción guiada",
        description: "Seguí el próximo paso recomendado para completar el flujo del turno.",
      },
    }),
    trackReceptionEvent: vi.fn(),
  }),
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
  nextAction: { title: "Completar check-in formal" },
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

beforeEach(() => {
  vi.clearAllMocks();
  mockController.mockReturnValue(controllerDefaults);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = vi.fn();
});

describe("BookingDetailsSheet", () => {
  it("renders the queue context pill and guided hint when guided mode is on", () => {
    render(
      <BookingDetailsSheet
        booking={booking}
        isOpen
        onClose={vi.fn()}
        queueBookingIds={["booking-1", "booking-2", "booking-3"]}
      />,
    );

    expect(screen.getByText(/Cola del turno/i)).toBeDefined();
    expect(screen.getByText(/Caso 1 de 3/i)).toBeDefined();
    expect(screen.getByText(/Recepción guiada/i)).toBeDefined();
    expect(screen.getByText(/Quedan 2 después de este caso/i)).toBeDefined();
  });

  it("moves focus to the guided section after mount when guidedFocusStep is set", async () => {
    render(
      <BookingDetailsSheet
        booking={booking}
        isOpen
        onClose={vi.fn()}
        guidedFocusStep="check-in"
      />,
    );

    await waitFor(() => {
      expect(document.activeElement?.id).toBe("reception-guide-check-in");
    });
  });

  it("navigates via the guided CTA without executing the check-in transition", async () => {
    render(
      <BookingDetailsSheet booking={booking} isOpen onClose={vi.fn()} guidedFocusStep="check-in" />,
    );

    const cta = screen.getByRole("button", { name: /Ir al checklist de llegada/i });
    fireEvent.click(cta);

    expect(controllerDefaults.handleStatusAction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("reception-guide-check-in");
    });
  });

  it("moves focus to the account section when guidedFocusStep is payment", async () => {
    mockController.mockReturnValue({
      ...controllerDefaults,
      bookingState: { ...booking, status: "CheckedIn" },
    });
    render(
      <BookingDetailsSheet
        booking={{ ...booking, status: "CheckedIn" }}
        isOpen
        onClose={vi.fn()}
        guidedFocusStep="payment"
      />,
    );

    await waitFor(() => {
      expect(document.activeElement?.id).toBe("reception-guide-payment");
    });
  });

  it("moves focus to the checkout section when guidedFocusStep is checkout", async () => {
    mockController.mockReturnValue({
      ...controllerDefaults,
      bookingState: { ...booking, status: "CheckedIn" },
    });
    render(
      <BookingDetailsSheet
        booking={{ ...booking, status: "CheckedIn" }}
        isOpen
        onClose={vi.fn()}
        guidedFocusStep="checkout"
      />,
    );

    await waitFor(() => {
      expect(document.activeElement?.id).toBe("reception-guide-checkout");
    });
  });

  it("continues to the next case of the turn queue", () => {
    const onOpenQueuedBooking = vi.fn();
    render(
      <BookingDetailsSheet
        booking={booking}
        isOpen
        onClose={vi.fn()}
        queueBookingIds={["booking-1", "booking-2", "booking-3"]}
        onOpenQueuedBooking={onOpenQueuedBooking}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Continuar con siguiente/i }));

    expect(onOpenQueuedBooking).toHaveBeenCalledWith("booking-2");
  });
});
