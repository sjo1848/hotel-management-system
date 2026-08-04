import { useEffect, useMemo, useRef } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import type { Room } from "@/types/domain";
import {
  buildRoomStatusCounts,
  filterRooms,
  STATUS_FILTER_OPTIONS,
  type InventoryStatusFilter,
} from "@/features/rooms/utils/roomInventoryFilter";
import type { BulkTarget } from "@/features/rooms/utils/roomBulkActions";
import {
  getRoomStatusBadge,
  getRoomStatusMeta,
} from "./roomPresentation";
import RoomActionsMenu from "./RoomActionsMenu";import { RoomBulkActionBar } from "./RoomBulkActionBar";

const IndeterminateCheckbox = ({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate && !checked;
    }
  }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-border text-primary"
    />
  );
};

export type RoomsInventoryPanelProps = {
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: InventoryStatusFilter;
  onStatusFilterChange: (filter: InventoryStatusFilter) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  selectedRoomIds: string[];
  onToggleSelection: (roomId: string) => void;
  canManageStatus: boolean;
  canManageInventory: boolean;
  canCreateBooking: boolean;
  onReserve: (room: Room) => void;
  onViewDetails: (room: Room) => void;
  onChangeStatus: (room: Room, status: "AVAILABLE" | "DIRTY") => void;
  onRefresh: () => void;
  onCreateRoom: () => void;
  bulkBusy: BulkTarget | null;
  onApplyBulk: (target: BulkTarget) => void;
  onClearSelection: () => void;
};

export const RoomsInventoryPanel = ({
  rooms,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  selectedRoomIds,
  onToggleSelection,
  canManageStatus,
  canManageInventory,
  canCreateBooking,
  onReserve,
  onViewDetails,
  onChangeStatus,
  onRefresh,
  onCreateRoom,
  bulkBusy,
  onApplyBulk,
  onClearSelection,
}: RoomsInventoryPanelProps) => {
  const counts = useMemo(() => buildRoomStatusCounts(rooms), [rooms]);
  const filteredRooms = useMemo(
    () => filterRooms(rooms, searchQuery, statusFilter),
    [rooms, searchQuery, statusFilter],
  );
  const allVisibleSelected =
    filteredRooms.length > 0 &&
    filteredRooms.every((room) => selectedRoomIds.includes(room.id));
  const outOfFilterCount = selectedRoomIds.filter(
    (id) =>
      rooms.some((room) => room.id === id) &&
      !filteredRooms.some((room) => room.id === id),
  ).length;
  const selectedRooms = useMemo(
    () => rooms.filter((room) => selectedRoomIds.includes(room.id)),
    [rooms, selectedRoomIds],
  );

  const alertMessage = useMemo(() => {
    if (counts.maintenance > 0) {
      return `${counts.maintenance} habitación${counts.maintenance > 1 ? "es" : ""} en mantenimiento. Se resuelven desde Housekeeping.`;
    }
    if (counts.available === 0 && counts.total > 0) {
      return "No hay habitaciones disponibles en este momento.";
    }
    return null;
  }, [counts.available, counts.maintenance, counts.total]);

  const toggleVisibleRooms = () => {
    filteredRooms.forEach((room) => {
      if (!selectedRoomIds.includes(room.id)) {
        onToggleSelection(room.id);
      }
    });
  };

  const selectionColumn: Column<Room> | null = canManageStatus
    ? {
        header: (
          <div className="flex items-center justify-center">
            <IndeterminateCheckbox
              label="Seleccionar habitaciones visibles"
              checked={allVisibleSelected}
              indeterminate={filteredRooms.some((room) => selectedRoomIds.includes(room.id))}
              onChange={toggleVisibleRooms}
            />
          </div>
        ),
        className: "w-12",
        cell: (room) => (
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              aria-label={`Seleccionar habitación ${room.room_number}`}
              checked={selectedRoomIds.includes(room.id)}
              onChange={() => onToggleSelection(room.id)}
              className="h-4 w-4 rounded border-border text-primary"
            />
          </div>
        ),
      }
    : null;

  const columns: Column<Room>[] = [
    ...(selectionColumn ? [selectionColumn] : []),
    {
      header: "Habitación",
      cell: (room) => {
        const statusMeta = getRoomStatusMeta(room.status);
        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm",
                statusMeta.accentClassName,
              )}
            >
              {room.room_number}
            </div>
            <div className="font-semibold text-foreground">Habitación {room.room_number}</div>
          </div>
        );
      },
    },
    {
      header: "Tipo",
      cell: (room) => <span className="text-muted-foreground">{room.room_type}</span>,
      className: "w-36",
    },
    {
      header: "Estado",
      cell: (room) => getRoomStatusBadge(room.status),
      className: "w-40",
    },
    {
      header: "Tarifa base",
      cell: (room) => (
        <span className="font-mono font-medium text-foreground">
          ${(room.price_cents / 100).toLocaleString("es-AR")}
        </span>
      ),
      className: "w-40",
    },
    {
      header: "Gestión",
      className: "w-[220px]",
      cell: (room) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {room.status === "Available" && canCreateBooking ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-emerald-500/20 bg-emerald-500/10 text-xs font-bold uppercase text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              onClick={() => onReserve(room)}
            >
              Reservar
            </Button>
          ) : null}
          {canManageInventory || canManageStatus ? (
            <RoomActionsMenu
              status={room.status}
              canEdit={canManageInventory}
              canChangeStatus={canManageStatus}
              onViewDetails={() => onViewDetails(room)}
              onEdit={canManageInventory ? () => onViewDetails(room) : undefined}
              onChangeStatus={(status) => onChangeStatus(room, status)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onSearchChange("");
              }
            }}
            placeholder="Buscar por número, tipo o estado..."
            aria-label="Buscar en el inventario"
            className="h-10 w-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => onSearchChange("")}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex w-full items-center rounded-xl border border-border bg-muted p-1 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 flex-1 rounded-lg px-3 sm:flex-none",
              viewMode === "grid"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onViewModeChange("grid")}
          >
            Compacta
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 flex-1 rounded-lg px-3 sm:flex-none",
              viewMode === "list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onViewModeChange("list")}
          >
            Tabla
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTER_OPTIONS.map((option) => {
          const active = statusFilter === option.value;
          const optionCount =
            option.value === "all"
              ? counts.total
              : option.value === "available"
                ? counts.available
                : option.value === "occupied"
                  ? counts.occupied
                  : option.value === "cleaning"
                    ? counts.cleaning
                    : counts.maintenance;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusFilterChange(option.value)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {option.label}{" "}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {optionCount}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {filteredRooms.length} resultados
        </span>
      </div>

      {canManageStatus && selectedRoomIds.length > 0 ? (
        <RoomBulkActionBar
          selectedRooms={selectedRooms}
          outOfFilterCount={outOfFilterCount}
          allVisibleSelected={allVisibleSelected}
          visibleCount={filteredRooms.length}
          busy={bulkBusy}
          onApply={onApplyBulk}
          onSelectVisible={toggleVisibleRooms}
          onClear={onClearSelection}
        />
      ) : null}

      {alertMessage && !error ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-200">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          {alertMessage}
        </div>
      ) : null}

      {viewMode === "list" ? (
        <DataTable
          columns={columns}
          data={filteredRooms}
          isLoading={isLoading}
          emptyMessage={
            rooms.length === 0
              ? "No hay habitaciones cargadas."
              : "No hay habitaciones que coincidan con la búsqueda actual."
          }
          error={error}
          onRetry={onRefresh}
          onRowClick={onViewDetails}
          actions={
            canManageInventory ? (
              <Button size="sm" className="h-9 rounded-xl" onClick={onCreateRoom}>
                <Plus className="h-4 w-4" />
                Añadir habitación
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {error ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-destructive">No se pudo cargar el inventario</p>
                <p className="mt-1 text-sm text-destructive/80">{error}</p>
              </div>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
                onClick={onRefresh}
              >
                Reintentar
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/40 py-16 text-center">
              <h3 className="text-lg font-bold text-foreground">No hay habitaciones cargadas</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {canManageInventory
                  ? "Crea la primera habitación para comenzar a operar el inventario."
                  : "Preguntá al equipo de administración para cargar habitaciones."}
              </p>
              {canManageInventory ? (
                <Button className="mt-4 h-10 rounded-xl" onClick={onCreateRoom}>
                  <Plus className="h-4 w-4" />
                  Crear habitación
                </Button>
              ) : null}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((card) => (
                <div key={card} className="h-[180px] rounded-2xl border border-border bg-muted animate-pulse" />
              ))}
            </div>
          ) : null}

          {!isLoading && !error && filteredRooms.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRooms.map((room) => {
                const statusMeta = getRoomStatusMeta(room.status);
                return (
                  <article
                    key={room.id}
                    aria-label={`Habitación ${room.room_number}`}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    {canManageStatus ? (
                      <label
                        className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 shadow-sm"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar habitación ${room.room_number}`}
                          checked={selectedRoomIds.includes(room.id)}
                          onChange={() => onToggleSelection(room.id)}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                      </label>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onViewDetails(room)}
                        aria-label={`Ver detalle de habitación ${room.room_number}`}
                        className="text-left"
                      >
                        <div
                          className={cn(
                            "inline-flex rounded-xl px-3 py-1 text-sm font-black text-white shadow-sm",
                            statusMeta.accentClassName,
                          )}
                        >
                          {room.room_number}
                        </div>
                        <h3 className="mt-3 text-base font-black tracking-tight text-foreground">
                          {room.room_type}
                        </h3>
                      </button>
                      {canManageInventory || canManageStatus ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <RoomActionsMenu
                            status={room.status}
                            canEdit={canManageInventory}
                            canChangeStatus={canManageStatus}
                            onViewDetails={() => onViewDetails(room)}
                            onEdit={canManageInventory ? () => onViewDetails(room) : undefined}
                            onChangeStatus={(status) => onChangeStatus(room, status)}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      {getRoomStatusBadge(room.status)}
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          Tarifa base
                        </p>
                        <p className="mt-1 font-mono font-bold text-foreground">
                          ${(room.price_cents / 100).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {room.status === "Available" && canCreateBooking ? (
                        <Button
                          className="h-10 rounded-xl"
                          onClick={(event) => {
                            event.stopPropagation();
                            onReserve(room);
                          }}
                        >
                          Reservar
                        </Button>
                      ) : null}
                      {canManageInventory ? (
                        <Button
                          variant="outline"
                          className="h-10 rounded-xl"
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewDetails(room);
                          }}
                        >
                          Ver detalle
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {canManageInventory ? (
                <button
                  type="button"
                  className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-4 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  onClick={onCreateRoom}
                >
                  <Plus className="h-6 w-6" />
                  <span className="mt-3 text-sm font-bold uppercase tracking-[0.2em]">
                    Agregar habitación
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
