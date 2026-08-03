import { useEffect, useMemo, useState } from "react";
import {
  bulkUpdateRoomStatus,
  getRoomById,
  getRoomHoldBoard,
  listRooms,
  searchAvailableRooms,
  updateRoomStatus,
} from "@/features/rooms/services/roomService";
import { getBookings } from "@/features/bookings/services/bookingService";
import type { Booking, Room, RoomHoldBoardEntry } from "@/types/domain";
import BookingDrawer from "@/features/bookings/components/BookingDrawer";
import RoomCreateDrawer from "./components/RoomCreateDrawer";
import { RoomAvailabilityPanel } from "./components/RoomAvailabilityPanel";
import RoomAdminSheet from "./components/RoomAdminSheet";
import { RoomDetailWorkspace } from "./components/RoomDetailWorkspace";
import RoomHoldsBoardPanel from "./components/RoomHoldsBoardPanel";
import RoomInventoryPlanner from "./components/RoomInventoryPlanner";
import { RoomsInventoryPanel } from "./components/RoomsInventoryPanel";
import type { InventoryStatusFilter } from "@/features/rooms/utils/roomInventoryFilter";
import { useToast } from "@/components/ui/toast";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";
import { useAuth } from "@/features/auth/useAuth";
import { roleHasCapability } from "@/features/auth/capabilities";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { RoomsWorkspace } from "./RoomsWorkspace";
import type { RoomsWorkspaceTab } from "./RoomsWorkspaceTabs";

const RoomsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RoomsWorkspaceTab>("inventory");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [holdBoardStart, setHoldBoardStart] = useState(new Date().toISOString().slice(0, 10));
  const [holdBoardEnd, setHoldBoardEnd] = useState(
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  );

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [isAdminSheetOpen, setIsAdminSheetOpen] = useState(false);
  const [bookingDates, setBookingDates] = useState<{ from: string; to: string } | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<InventoryStatusFilter>("all");
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState<null | "AVAILABLE" | "DIRTY">(null);
  const canManageInventory = roleHasCapability(user?.role, "rooms.write");
  const canManageStatus = roleHasCapability(user?.role, "rooms.status.write");
  const canCreateBooking = roleHasCapability(user?.role, "bookings.write");
  const canViewHolds = roleHasCapability(user?.role, "rooms.read");
  const canReadBookings = roleHasCapability(user?.role, "bookings.read");
  const plannerOrHoldsOpen = activeTab === "planner" || activeTab === "holds";
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const {
    data: roomsData,
    isLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = useResourceQuery<Room[]>({
    queryKey: "rooms:inventory",
    queryFn: () => listRooms(),
    staleTimeMs: 10_000,
    retry: false,
  });
  const availabilityQueryKey = useMemo(
    () => `rooms:availability:${bookingDates?.from ?? "none"}:${bookingDates?.to ?? "none"}`,
    [bookingDates?.from, bookingDates?.to],
  );
  const {
    data: availableRoomsData,
    isLoading: isAvailabilityLoading,
    error: availabilityError,
    refetch: refetchAvailability,
  } = useResourceQuery<Room[]>({
    queryKey: availabilityQueryKey,
    queryFn: () => searchAvailableRooms(bookingDates!.from, bookingDates!.to),
    enabled: bookingDates !== null,
    staleTimeMs: 10_000,
  });
  const holdBoardQueryKey = useMemo(
    () => `rooms:holds-board:${holdBoardStart}:${holdBoardEnd}`,
    [holdBoardEnd, holdBoardStart],
  );
  const {
    data: holdBoardData,
    isLoading: isHoldBoardLoading,
  } = useResourceQuery<RoomHoldBoardEntry[]>({
    queryKey: holdBoardQueryKey,
    queryFn: () => getRoomHoldBoard(holdBoardStart, holdBoardEnd),
    enabled: canViewHolds && plannerOrHoldsOpen,
    staleTimeMs: 15_000,
  });
  const plannerBookingsQueryKey = useMemo(
    () => `rooms:planner-bookings:${holdBoardStart}:${holdBoardEnd}`,
    [holdBoardEnd, holdBoardStart],
  );
  const {
    data: plannerBookingsData,
  } = useResourceQuery<Booking[]>({
    queryKey: plannerBookingsQueryKey,
    queryFn: () => getBookings(holdBoardStart, holdBoardEnd),
    enabled: activeTab === "planner" && canReadBookings,
    staleTimeMs: 15_000,
  });

  const rooms = useMemo(() => roomsData ?? [], [roomsData]);
  const availableRooms = useMemo(() => availableRoomsData ?? [], [availableRoomsData]);
  const holdBoard = useMemo(() => holdBoardData ?? [], [holdBoardData]);
  const plannerBookings = useMemo(() => plannerBookingsData ?? [], [plannerBookingsData]);

  useEffect(() => {
    if (!selectedRoom) return;
    const fresh = rooms.find((room) => room.id === selectedRoom.id);
    if (fresh) {
      setSelectedRoom(fresh);
    }
  }, [rooms]);

  const refreshRooms = async () => {
    setIsRefreshing(true);
    try {
      invalidateResource(availabilityQueryKey);
      invalidateResource(holdBoardQueryKey);
      invalidateResource(plannerBookingsQueryKey);
      await refetchRooms();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBookingSuccess = async () => {
    await refreshRooms();
  };

  const handleUpdateStatus = async (
    roomId: string,
    status: "AVAILABLE" | "DIRTY",
  ) => {
    try {
      await updateRoomStatus(roomId, status);
      toast({ title: "Estado actualizado", variant: "success" });
      await refreshRooms();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo actualizar el estado"),
        variant: "error",
      });
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId],
    );
  };

  const clearSelection = () => setSelectedRoomIds([]);

  const handleBulkStatusUpdate = async (
    status: "AVAILABLE" | "DIRTY",
    successLabel: string,
  ) => {
    if (selectedRoomIds.length === 0) {
      return;
    }

    setBulkUpdatingStatus(status);
    try {
      const result = await bulkUpdateRoomStatus(selectedRoomIds, status);
      toast({
        title: "Acción masiva aplicada",
        description: `${result.updated_count} habitaciones pasaron a ${successLabel}.`,
        variant: "success",
      });
      clearSelection();
      await refreshRooms();
    } catch (error: unknown) {
      toast({
        title: "No se pudo aplicar la acción masiva",
        description: getErrorMessage(error, "Revisa las habitaciones seleccionadas e intenta nuevamente."),
        variant: "error",
      });
    } finally {
      setBulkUpdatingStatus(null);
    }
  };

  const openRoomAdmin = (room: Room) => {
    setSelectedRoom(room);
    setIsAdminSheetOpen(!isDesktop);
  };

  const closeRoomAdminSheet = (open: boolean) => {
    setIsAdminSheetOpen(open);
    if (!open && selectedRoom) {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[aria-label="Ver detalle de habitación ${selectedRoom.room_number}"]`)
          ?.focus();
      });
    }
  };

  const openRoomAdminFromBoard = async (roomId: string) => {
    const existing = rooms.find((room) => room.id === roomId);
    if (existing) {
      openRoomAdmin(existing);
      return;
    }

    try {
      const room = await getRoomById(roomId);
      openRoomAdmin(room);
    } catch (error: unknown) {
      toast({
        title: "No se pudo abrir la habitación",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
    }
  };

  const openBooking = (room: Room) => {
    setSelectedRoom(room);
    setIsBookingDrawerOpen(true);
  };

  const inventoryView =
    isDesktop && selectedRoom ? (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <RoomsInventoryPanel
          rooms={rooms}
          isLoading={isLoading}
          error={roomsError}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedRoomIds={selectedRoomIds}
          onToggleSelection={toggleRoomSelection}
          canManageStatus={canManageStatus}
          canManageInventory={canManageInventory}
          canCreateBooking={canCreateBooking}
          onReserve={openBooking}
          onViewDetails={openRoomAdmin}
          onChangeStatus={(room, status) => handleUpdateStatus(room.id, status)}
          onRefresh={refreshRooms}
          onCreateRoom={() => setIsCreateOpen(true)}
          bulkBusy={bulkUpdatingStatus}
          onApplyBulk={(target) => handleBulkStatusUpdate(target, target === "AVAILABLE" ? "disponible" : "limpieza")}
          onClearSelection={clearSelection}
        />
        <aside className="hidden min-w-0 lg:block">
          <div className="h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <RoomDetailWorkspace
              room={selectedRoom}
              canManageInventory={canManageInventory}
              canManageStatus={canManageStatus}
              canCreateBooking={canCreateBooking}
              onReserve={openBooking}
              onRequestClose={() => setSelectedRoom(null)}
              onSaved={refreshRooms}
            />
          </div>
        </aside>
      </div>
    ) : (
      <RoomsInventoryPanel
        rooms={rooms}
        isLoading={isLoading}
        error={roomsError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedRoomIds={selectedRoomIds}
        onToggleSelection={toggleRoomSelection}
        canManageStatus={canManageStatus}
        canManageInventory={canManageInventory}
        canCreateBooking={canCreateBooking}
        onReserve={openBooking}
        onViewDetails={openRoomAdmin}
        onChangeStatus={(room, status) => handleUpdateStatus(room.id, status)}
        onRefresh={refreshRooms}
        onCreateRoom={() => setIsCreateOpen(true)}
        bulkBusy={bulkUpdatingStatus}
        onApplyBulk={(target) => handleBulkStatusUpdate(target, target === "AVAILABLE" ? "disponible" : "limpieza")}
        onClearSelection={clearSelection}
      />
    );

  const availabilityView = (
    <RoomAvailabilityPanel
      dates={bookingDates}
      isLoading={isAvailabilityLoading}
      error={availabilityError}
      availableRooms={availableRooms}
      canCreateBooking={canCreateBooking}
      onSearch={(from, to) => setBookingDates({ from, to })}
      onClear={() => setBookingDates(null)}
      onRetry={() => void refetchAvailability()}
      onReserve={openBooking}
    />
  );

  const plannerView = (
    <RoomInventoryPlanner
      rooms={rooms}
      holds={holdBoard}
      bookings={plannerBookings}
      startDate={holdBoardStart}
      onManageRoom={openRoomAdminFromBoard}
    />
  );

  const holdsView = canViewHolds ? (
    <RoomHoldsBoardPanel
      holds={holdBoard}
      loading={isHoldBoardLoading}
      startDate={holdBoardStart}
      endDate={holdBoardEnd}
      onStartDateChange={setHoldBoardStart}
      onEndDateChange={setHoldBoardEnd}
      onManageRoom={openRoomAdminFromBoard}
    />
  ) : null;

  return (
    <>
      <RoomsWorkspace
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canManageInventory={canManageInventory}
        isRefreshing={isRefreshing}
        onRefresh={refreshRooms}
        onCreateRoom={() => setIsCreateOpen(true)}
        inventory={inventoryView}
        availability={availabilityView}
        planner={plannerView}
        holds={holdsView}
      />

      <BookingDrawer
        room={selectedRoom}
        dates={bookingDates}
        isOpen={isBookingDrawerOpen}
        onClose={() => setIsBookingDrawerOpen(false)}
        onSuccess={handleBookingSuccess}
      />

      <RoomCreateDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refreshRooms}
      />

      <RoomAdminSheet
        room={selectedRoom}
        open={isAdminSheetOpen}
        canManageInventory={canManageInventory}
        canManageStatus={canManageStatus}
        canCreateBooking={canCreateBooking}
        onOpenChange={closeRoomAdminSheet}
        onReserve={openBooking}
        onSaved={refreshRooms}
      />
    </>
  );
};

export default RoomsPage;
