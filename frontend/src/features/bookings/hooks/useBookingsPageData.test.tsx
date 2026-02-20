import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingsPageData } from "@/features/bookings/hooks/useBookingsPageData";
import type { Booking } from "@/types/domain";

const mockUseResourceQuery = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/useResourceQuery", () => ({
  useResourceQuery: (...args: unknown[]) => mockUseResourceQuery(...args),
  invalidateResource: vi.fn(),
}));

const mockBookings: Booking[] = [
  {
    id: "BKG-AAA-1",
    hotel_id: "hotel-1",
    room_id: "room-1",
    guest_id: "guest-1",
    guest_name: "Ana Lopez",
    check_in: "2026-03-01",
    check_out: "2026-03-03",
    total_price_cents: 10000,
    status: "Confirmed",
  },
  {
    id: "xyz-222",
    hotel_id: "hotel-1",
    room_id: "room-2",
    guest_id: "guest-2",
    guest_name: "Carlos Diaz",
    check_in: "2026-03-02",
    check_out: "2026-03-05",
    total_price_cents: 20000,
    status: "CheckedIn",
  },
  {
    id: "res-333",
    hotel_id: "hotel-1",
    room_id: "room-3",
    guest_id: "guest-3",
    guest_name: "Maria Perez",
    check_in: "2026-03-03",
    check_out: "2026-03-06",
    total_price_cents: 15000,
    status: "CheckedIn",
  },
];

describe("useBookingsPageData search filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResourceQuery.mockReturnValue({
      data: mockBookings,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("filters by guest name and booking id (case-insensitive)", () => {
    const { result } = renderHook(() => useBookingsPageData());

    expect(result.current.filteredBookings).toHaveLength(3);

    act(() => {
      result.current.setSearchQuery("ana");
    });
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(["BKG-AAA-1"]);

    act(() => {
      result.current.setSearchQuery("XYZ-222");
    });
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(["xyz-222"]);

    act(() => {
      result.current.setSearchQuery("   ");
    });
    expect(result.current.filteredBookings).toHaveLength(3);
  });

  it("combines status and search filters without leaking mismatched rows", () => {
    const { result } = renderHook(() => useBookingsPageData());

    act(() => {
      result.current.setFilterStatus("CheckedIn");
    });
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(["xyz-222", "res-333"]);

    act(() => {
      result.current.setSearchQuery("maria");
    });
    expect(result.current.filteredBookings.map((booking) => booking.id)).toEqual(["res-333"]);

    act(() => {
      result.current.setSearchQuery("ana");
    });
    expect(result.current.filteredBookings).toHaveLength(0);
  });
});
