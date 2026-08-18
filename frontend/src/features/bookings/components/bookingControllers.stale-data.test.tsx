import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types/domain";
import { useBookingBillingController } from "./useBookingBillingController";
import { useBookingOperationalController } from "./useBookingOperationalController";

const billingService = vi.hoisted(() => ({
  getExtraCharges: vi.fn(),
}));
const invoiceService = vi.hoisted(() => ({
  getInvoiceByBooking: vi.fn(),
  getBookingPayments: vi.fn(),
}));
const roomService = vi.hoisted(() => ({
  getRoomById: vi.fn(),
  getAllRooms: vi.fn(),
}));

vi.mock("@/features/bookings/services/extraChargeService", () => ({
  default: billingService,
}));
vi.mock("@/features/bookings/services/invoiceService", () => ({
  getInvoiceByBooking: invoiceService.getInvoiceByBooking,
  getBookingPayments: invoiceService.getBookingPayments,
  registerBookingPayment: vi.fn(),
}));
vi.mock("@/features/rooms/services/roomService", () => ({
  default: roomService,
}));
vi.mock("@/features/bookings/services/bookingService", () => ({
  updateBooking: vi.fn(),
}));

const booking = (id: string): Booking => ({
  id,
  hotel_id: "hotel-1",
  room_id: `room-${id}`,
  guest_id: null,
  guest_name: `Guest ${id}`,
  check_in: "2026-03-01",
  check_out: "2026-03-03",
  total_price_cents: 20_000,
  status: "Confirmed",
  operational_data: {},
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe("booking controller stale-data guards", () => {
  it("does not expose booking A billing while booking B is loading or disabled", async () => {
    const a = booking("A");
    const b = booking("B");
    const aCharges = deferred<Array<{ id: string; amount_cents: number }>>();
    const aInvoice = deferred<{ id: string; amount_cents: number; paid_amount_cents: number }>();
    const aPayments = deferred<Array<{ id: string; amount_cents: number }>>();

    billingService.getExtraCharges.mockReturnValueOnce(aCharges.promise).mockResolvedValueOnce([]);
    invoiceService.getInvoiceByBooking.mockReturnValueOnce(aInvoice.promise).mockResolvedValueOnce(null);
    invoiceService.getBookingPayments.mockReturnValueOnce(aPayments.promise).mockResolvedValueOnce([]);

    const { result, rerender } = renderHook(
      ({ currentBooking, enabled }) =>
        useBookingBillingController({
          bookingState: currentBooking,
          isOpen: true,
          enabled,
          toast: vi.fn(),
          onBookingTotalDelta: vi.fn(),
        }),
      { initialProps: { currentBooking: a, enabled: true } },
    );

    await act(async () => rerender({ currentBooking: b, enabled: true }));
    expect(result.current.invoice).toBeNull();
    expect(result.current.payments).toEqual([]);
    expect(result.current.extraCharges).toEqual([]);
    expect(result.current.outstandingAmountCents).toBe(b.total_price_cents);

    await act(async () => rerender({ currentBooking: b, enabled: false }));
    expect(result.current.invoice).toBeNull();
    expect(result.current.payments).toEqual([]);
    expect(result.current.extraCharges).toEqual([]);

    await act(async () => {
      aCharges.resolve([{ id: "charge-A", amount_cents: 8_000 }]);
      aInvoice.resolve({ id: "invoice-A", amount_cents: 20_000, paid_amount_cents: 1_000 });
      aPayments.resolve([{ id: "payment-A", amount_cents: 1_000 }]);
    });

    await waitFor(() => {
      expect(result.current.invoice).toBeNull();
      expect(result.current.payments).toEqual([]);
      expect(result.current.extraCharges).toEqual([]);
      expect(result.current.outstandingAmountCents).toBe(b.total_price_cents);
    });
  });

  it("does not expose booking A room selection or reason after switching to B", async () => {
    const a = booking("A");
    const b = booking("B");
    const aRooms = deferred<Array<{ id: string; room_number: string; status: string }>>();
    const bRooms = deferred<Array<{ id: string; room_number: string; status: string }>>();

    roomService.getRoomById.mockResolvedValue({ id: "room-current", room_number: "101", status: "Available" });
    roomService.getAllRooms.mockReturnValueOnce(aRooms.promise).mockReturnValueOnce(bRooms.promise);

    const { result, rerender } = renderHook(
      ({ currentBooking }) =>
        useBookingOperationalController({
          booking: currentBooking,
          isOpen: true,
          roomOptionsEnabled: true,
          toast: vi.fn(),
          refreshBillingData: vi.fn().mockResolvedValue(undefined),
        }),
      { initialProps: { currentBooking: a } },
    );

    await waitFor(() => expect(roomService.getAllRooms).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.setSelectedRoomId("room-A-option");
      result.current.setReassignmentReason("reason from booking A");
      rerender({ currentBooking: b });
    });

    expect(result.current.roomOptions).toEqual([]);
    expect(result.current.selectedRoomId).toBe("");
    expect(result.current.reassignmentReason).toBe("");

    await act(async () => aRooms.resolve([{ id: "room-A-option", room_number: "201", status: "Available" }]));
    expect(result.current.roomOptions).toEqual([]);
    expect(result.current.selectedRoomId).toBe("");
    expect(result.current.reassignmentReason).toBe("");

    await act(async () => bRooms.resolve([{ id: "room-B-option", room_number: "301", status: "Available" }]));
    await waitFor(() => expect(result.current.roomOptions.map((room) => room.id)).toEqual(["room-B-option"]));
    expect(result.current.selectedRoomId).toBe("room-B-option");
    expect(result.current.reassignmentReason).toBe("");
  });

  it("does not apply a delayed operational refresh from A after switching to B", async () => {
    const a = booking("A");
    const b = booking("B");
    const delayedRoom = deferred<{ id: string; room_number: string; status: string }>();
    const refreshBillingData = vi.fn().mockResolvedValue(undefined);
    const onRefreshBooking = vi.fn().mockResolvedValue(undefined);

    roomService.getRoomById.mockReturnValueOnce(delayedRoom.promise);

    const { result, rerender } = renderHook(
      ({ currentBooking }) =>
        useBookingOperationalController({
          booking: currentBooking,
          isOpen: false,
          roomOptionsEnabled: false,
          toast: vi.fn(),
          refreshBillingData,
          onRefreshBooking,
        }),
      { initialProps: { currentBooking: a } },
    );

    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = result.current.refreshOperationalData(a);
      rerender({ currentBooking: b });
    });

    await act(async () => {
      delayedRoom.resolve({ id: "room-A", room_number: "101", status: "Available" });
      await refreshPromise;
    });

    expect(result.current.room).toBeNull();
    expect(refreshBillingData).not.toHaveBeenCalled();
    expect(onRefreshBooking).not.toHaveBeenCalled();
  });

  it("does not use booking A billing as an error fallback while refreshing booking B", async () => {
    const a = booking("A");
    const b = booking("B");
    const invoiceA = { id: "invoice-A", amount_cents: 20_000, paid_amount_cents: 4_000 };
    const paymentsA = [{ id: "payment-A", amount_cents: 4_000 }];
    billingService.getExtraCharges.mockResolvedValueOnce([{ id: "charge-A", amount_cents: 2_000 }]).mockRejectedValueOnce(new Error("B unavailable"));
    invoiceService.getInvoiceByBooking.mockResolvedValueOnce(invoiceA).mockRejectedValueOnce(new Error("B unavailable"));
    invoiceService.getBookingPayments.mockResolvedValueOnce(paymentsA).mockRejectedValueOnce(new Error("B unavailable"));

    const { result } = renderHook(() =>
      useBookingBillingController({
        bookingState: a,
        isOpen: true,
        toast: vi.fn(),
        onBookingTotalDelta: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.invoice).toEqual(invoiceA));
    expect(result.current.payments).toEqual(paymentsA);

    await act(async () => result.current.refreshBillingData(b));

    expect(result.current.invoice).toBeNull();
    expect(result.current.payments).toEqual([]);
    expect(result.current.extraCharges).toEqual([]);
  });
});
