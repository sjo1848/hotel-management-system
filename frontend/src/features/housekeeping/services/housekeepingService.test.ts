import { beforeEach, describe, expect, it, vi } from "vitest";
import client from "@/api/client";
import { getDirtyRooms } from "./housekeepingService";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("housekeepingService contract mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes room status for dirty rooms payload", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: "r1",
          hotel_id: "h1",
          room_number: "101",
          room_type: "SINGLE",
          price_cents: 5000,
          status: "dirty",
        },
      ],
    });

    const rooms = await getDirtyRooms();

    expect(client.get).toHaveBeenCalledWith("/housekeeping/dirty");
    expect(rooms[0].status).toBe("Dirty");
  });
});
