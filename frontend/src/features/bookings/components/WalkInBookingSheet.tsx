import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/api/errors";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import type { Booking, Guest, Room } from "@/types/domain";
import { createBooking } from "@/features/bookings/services/bookingService";
import { createGuest, getGuests } from "@/features/guests/services/guestService";
import roomService from "@/features/rooms/services/roomService";
import {
  WalkInGuestSection,
  WalkInRoomSelectionSection,
  WalkInSidebarPanels,
  WalkInStaySection,
} from "@/features/bookings/components/WalkInSections";

type WalkInBookingSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (booking: Booking) => Promise<void> | void;
};

type GuestMode = "existing" | "new";

const defaultCheckIn = format(new Date(), "yyyy-MM-dd");
const defaultCheckOut = format(addDays(new Date(), 1), "yyyy-MM-dd");

const WalkInBookingSheet = ({ isOpen, onClose, onCreated }: WalkInBookingSheetProps) => {
  const { toast } = useToast();
  const [guestMode, setGuestMode] = useState<GuestMode>("existing");
  const [guestSearch, setGuestSearch] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [guestPickerOpen, setGuestPickerOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stay, setStay] = useState({
    check_in: defaultCheckIn,
    check_out: defaultCheckOut,
  });
  const [newGuest, setNewGuest] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const {
    data: guestsData,
    isLoading: guestsLoading,
    error: guestsError,
    refetch: refetchGuests,
  } = useResourceQuery<Guest[]>({
    queryKey: "guests:list",
    queryFn: getGuests,
    enabled: isOpen,
    staleTimeMs: 30_000,
  });

  const guests = useMemo(() => guestsData ?? [], [guestsData]);

  const nights = useMemo(() => {
    if (!stay.check_in || !stay.check_out) return 0;
    return Math.max(0, differenceInCalendarDays(parseISO(stay.check_out), parseISO(stay.check_in)));
  }, [stay.check_in, stay.check_out]);

  const selectedGuest = useMemo(
    () => guests.find((guest) => guest.id === selectedGuestId) ?? null,
    [guests, selectedGuestId],
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const filteredGuests = useMemo(() => {
    const term = guestSearch.trim().toLowerCase();
    if (!term) return guests.slice(0, 8);
    return guests
      .filter((guest) =>
        [guest.full_name, guest.email, guest.phone ?? ""].some((value) =>
          value.toLowerCase().includes(term),
        ),
      )
      .slice(0, 8);
  }, [guestSearch, guests]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadAvailableRooms = async () => {
      if (!stay.check_in || !stay.check_out || nights <= 0) {
        setRooms([]);
        setSelectedRoomId(null);
        setRoomsError(null);
        return;
      }

      setRoomsLoading(true);
      setRoomsError(null);

      try {
        const availableRooms = await roomService.getAllRooms(stay.check_in, stay.check_out);
        if (cancelled) return;
        setRooms(availableRooms);
        setSelectedRoomId((current) =>
          current && availableRooms.some((room) => room.id === current) ? current : null,
        );
      } catch (error: unknown) {
        if (cancelled) return;
        setRooms([]);
        setSelectedRoomId(null);
        setRoomsError(getErrorMessage(error, "No se pudo cargar la disponibilidad."));
      } finally {
        if (!cancelled) {
          setRoomsLoading(false);
        }
      }
    };

    void loadAvailableRooms();

    return () => {
      cancelled = true;
    };
  }, [isOpen, stay.check_in, stay.check_out, nights]);

  useEffect(() => {
    if (!isOpen) {
      setGuestMode("existing");
      setGuestSearch("");
      setSelectedGuestId(null);
      setGuestPickerOpen(false);
      setSelectedRoomId(null);
      setRoomPickerOpen(false);
      setRooms([]);
      setRoomsError(null);
      setRoomsLoading(false);
      setSubmitting(false);
      setStay({
        check_in: defaultCheckIn,
        check_out: defaultCheckOut,
      });
      setNewGuest({
        full_name: "",
        email: "",
        phone: "",
      });
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stay.check_in || !stay.check_out || nights <= 0) {
      toast({
        title: "Fechas invalidas",
        description: "La salida debe ser posterior a la entrada.",
        variant: "error",
      });
      return;
    }

    if (!selectedRoom) {
      toast({
        title: "Habitacion requerida",
        description: "Selecciona una habitacion disponible para continuar.",
        variant: "error",
      });
      return;
    }

    if (guestMode === "existing" && !selectedGuest) {
      toast({
        title: "Huesped requerido",
        description: "Selecciona un huesped existente o cambia a alta rapida.",
        variant: "error",
      });
      return;
    }

    if (
      guestMode === "new" &&
      (!newGuest.full_name.trim() || !newGuest.email.trim())
    ) {
      toast({
        title: "Datos incompletos",
        description: "Nombre y email son obligatorios para registrar el huesped.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);

    try {
      const guest =
        guestMode === "new"
          ? await createGuest({
              full_name: newGuest.full_name.trim(),
              email: newGuest.email.trim(),
              phone: newGuest.phone.trim() || undefined,
              created_at: new Date().toISOString(),
            })
          : selectedGuest;

      if (guestMode === "new") {
        invalidateResource("guests:list");
      }

      const booking = await createBooking({
        room_id: selectedRoom.id,
        guest_id: guest?.id ?? null,
        guest_name:
          guestMode === "new" ? newGuest.full_name.trim() : selectedGuest?.full_name ?? "",
        check_in: stay.check_in,
        check_out: stay.check_out,
      });

      toast({
        title: "Reserva creada",
        description: `${booking.guest_name} ya quedo registrado en recepcion.`,
        variant: "success",
      });

      onClose();
      await onCreated(booking);
    } catch (error: unknown) {
      toast({
        title: "No se pudo crear la reserva",
        description: getErrorMessage(error, "Revisa los datos y reintenta."),
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-hidden border-l border-border bg-card p-0 sm:max-w-[880px]">
        <div className="flex min-h-0 flex-1 flex-col">
        <SheetHeader className="border-b px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Front Desk
              </div>
              <div>
                <SheetTitle className="text-2xl font-black tracking-tight">
                  Walk-in / nueva reserva
                </SheetTitle>
                <SheetDescription className="mt-2 max-w-[60ch] text-sm">
                  Recepcion registra fechas, huesped y habitacion en un solo flujo. Al cerrar, la reserva abre directo en el centro operativo.
                </SheetDescription>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Objetivo
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Crear reserva sin salir de recepcion
              </p>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <WalkInStaySection
                checkIn={stay.check_in}
                checkOut={stay.check_out}
                minCheckIn={defaultCheckIn}
                nights={nights}
                onCheckInChange={(value) =>
                  setStay((current) => ({ ...current, check_in: value }))
                }
                onCheckOutChange={(value) =>
                  setStay((current) => ({ ...current, check_out: value }))
                }
              />

              <WalkInGuestSection
                guestMode={guestMode}
                guestSearch={guestSearch}
                selectedGuestId={selectedGuestId}
                filteredGuests={filteredGuests}
                guestsLoading={guestsLoading}
                guestsError={guestsError}
                newGuest={newGuest}
                onGuestModeChange={setGuestMode}
                onGuestSearchChange={setGuestSearch}
                onRefreshGuests={() => {
                  void refetchGuests();
                }}
                onSelectGuest={setSelectedGuestId}
                guestPickerOpen={guestPickerOpen}
                onGuestPickerOpenChange={setGuestPickerOpen}
                onNewGuestChange={(patch) =>
                  setNewGuest((current) => ({ ...current, ...patch }))
                }
              />

              <WalkInRoomSelectionSection
                nights={nights}
                roomsLoading={roomsLoading}
                roomsError={roomsError}
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
                roomPickerOpen={roomPickerOpen}
                onRoomPickerOpenChange={setRoomPickerOpen}
              />
            </div>

            <aside className="hidden space-y-4 lg:block">
              <WalkInSidebarPanels
                guestMode={guestMode}
                selectedGuest={selectedGuest}
                newGuestName={newGuest.full_name}
                selectedRoom={selectedRoom}
                nights={nights}
                checkIn={stay.check_in}
                checkOut={stay.check_out}
              />
            </aside>
          </section>
          </div>

          <SheetFooter className="border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-5">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-sm text-muted-foreground sm:block">
                Al crear, la reserva abre directo en el centro operativo para continuar con check-in o cuenta.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl sm:w-auto"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-lg sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Crear y gestionar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WalkInBookingSheet;
