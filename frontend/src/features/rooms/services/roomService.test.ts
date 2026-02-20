import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPatch } from "@/api/sdk";
import { getAllRooms, updateRoomStatus } from "./roomService";

vi.mock("@/api/sdk", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

describe("roomService contract mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes room status variants on list endpoint", async () => {
    (apiGet as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "r1",
        hotel_id: "h1",
        room_number: "101",
        room_type: "SINGLE",
        price_cents: 5000,
        status: "available",
      },
    ]);

    const rooms = await getAllRooms();

    expect(apiGet).toHaveBeenCalledWith("/rooms", undefined);
    expect(rooms[0].status).toBe("Available");
  });

  it("sends backend-compatible status payload on update", async () => {
    (apiPatch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "ok" });

    await updateRoomStatus("r1", "Available");
    expect(apiPatch).toHaveBeenCalledWith("/rooms/r1/status", { status: "AVAILABLE" });

    await updateRoomStatus("r1", "MAINTENANCE");
    expect(apiPatch).toHaveBeenCalledWith("/rooms/r1/status", { status: "MAINTENANCE" });
  });

  it("rejects unsupported statuses before hitting API", async () => {
    await expect(updateRoomStatus("r1", "Cleaning")).rejects.toThrow(
      "Estado de habitación inválido para actualización: Cleaning",
    );
  });
});
