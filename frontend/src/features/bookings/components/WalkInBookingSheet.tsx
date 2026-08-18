import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Loader2, Sparkles } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/api/errors";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { useMediaQuery } from "@/lib/useMediaQuery";
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
  const [mobileStep, setMobileStep] = useState(0);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
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
    enabled: isOpen && (isDesktop || mobileStep === 1),
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
  const selectedGuestName = guestMode === "new" ? newGuest.full_name.trim() || "Nuevo huésped" : selectedGuest?.full_name ?? "Sin seleccionar";
  const mobileSteps = ["Estadía", "Huésped", "Habitación", "Revisar"];
  const handleGuestPickerChange = (open: boolean) => {
    if (open) setRoomPickerOpen(false);
    setGuestPickerOpen(open);
  };
  const handleRoomPickerChange = (open: boolean) => {
    if (open) setGuestPickerOpen(false);
    setRoomPickerOpen(open);
  };

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
    if (!isDesktop && mobileStep !== 2) return;

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
  }, [isDesktop, isOpen, mobileStep, stay.check_in, stay.check_out, nights]);

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
      setMobileStep(0);
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
        <SheetHeader className="border-b px-4 py-3 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-3">
              <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary lg:inline-flex">
                <Sparkles className="h-3.5 w-3.5" />
                Front Desk
              </div>
              <div>
                <SheetTitle className="text-lg font-black tracking-tight sm:text-2xl">
                  Walk-in / nueva reserva
                </SheetTitle>
                <SheetDescription className="mt-2 hidden max-w-[60ch] text-sm sm:block">
                  Recepcion registra fechas, huesped y habitacion en un solo flujo. Al cerrar, la reserva abre directo en el centro operativo.
                </SheetDescription>
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Ayuda sobre nueva reserva" title="Ayuda" className="min-h-11 min-w-11 shrink-0 rounded-xl sm:hidden"><Info className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 text-sm">Completá cada paso y avanzá. El estado se conserva al volver desde los selectores.</PopoverContent>
            </Popover>
          </div>
          <nav className="flex items-center gap-1 text-xs font-semibold text-muted-foreground sm:hidden" aria-label="Progreso de nueva reserva">
            {mobileSteps.map((label, index) => index < mobileStep ? (
              <button key={label} type="button" className="min-h-11 rounded-lg px-1 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Volver al paso ${index + 1}: ${label}`} onClick={() => setMobileStep(index)}>{index + 1}. {label}</button>
            ) : (
              <span key={label} className={index === mobileStep ? "min-h-11 px-1 py-3 text-primary" : "min-h-11 px-1 py-3"} aria-current={index === mobileStep ? "step" : undefined}>{index + 1}. {label}</span>
            ))}
          </nav>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              {(isDesktop || mobileStep === 0) ? <div><WalkInStaySection
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
              /></div> : null}

              {(isDesktop || mobileStep === 1) ? <div><WalkInGuestSection
                guestMode={guestMode}
                guestSearch={guestSearch}
                selectedGuestId={selectedGuestId}
                selectedGuest={selectedGuest}
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
                onGuestPickerOpenChange={handleGuestPickerChange}
                onNewGuestChange={(patch) =>
                  setNewGuest((current) => ({ ...current, ...patch }))
                }
              /></div> : null}

              {(isDesktop || mobileStep === 2) ? <div><WalkInRoomSelectionSection
                nights={nights}
                roomsLoading={roomsLoading}
                roomsError={roomsError}
                rooms={rooms}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
                roomPickerOpen={roomPickerOpen}
                onRoomPickerOpenChange={handleRoomPickerChange}
              /></div> : null}
              <div data-testid="mobile-review-summary" className="rounded-2xl border border-border bg-muted/30 p-4 lg:hidden" hidden={mobileStep !== 3}>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Revisar</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Estadía</dt><dd className="text-right font-semibold">{stay.check_in ? format(parseISO(stay.check_in), "dd/MM/yyyy") : "—"} → {stay.check_out ? format(parseISO(stay.check_out), "dd/MM/yyyy") : "—"}<span className="block text-xs font-normal text-muted-foreground">{nights} {nights === 1 ? "noche" : "noches"}</span></dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Huésped</dt><dd className="text-right font-semibold">{selectedGuestName}</dd></div>
                  <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Habitación</dt><dd className="text-right font-semibold">{selectedRoom ? `Habitación ${selectedRoom.room_number}` : "Sin seleccionar"}<span className="block text-xs font-normal text-muted-foreground">{selectedRoom?.room_type ?? ""}</span></dd></div>
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">La reserva abrirá el centro operativo para continuar.</p>
              </div>
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

          <SheetFooter className="border-t bg-card/95 px-4 py-2.5 backdrop-blur sm:px-6 sm:py-5">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-sm text-muted-foreground sm:block">
                Al crear, la reserva abre directo en el centro operativo para continuar con check-in o cuenta.
              </p>
              <div className="flex w-full gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 rounded-xl sm:w-auto sm:flex-none"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                {isDesktop ? <Button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 flex-1 rounded-xl bg-primary text-primary-foreground shadow-lg sm:w-auto sm:flex-none"
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
                </Button> : <>
                  {mobileStep > 0 ? <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl sm:w-auto sm:flex-none" onClick={() => setMobileStep((step) => step - 1)}><ChevronLeft className="h-4 w-4" /> Atrás</Button> : null}
                  {mobileStep < 3 ? <Button type="button" className="min-h-11 flex-1 rounded-xl sm:w-auto sm:flex-none" onClick={() => {
                    const ready = mobileStep === 0
                      ? Boolean(stay.check_in && stay.check_out && nights > 0)
                      : mobileStep === 1
                        ? guestMode === "existing" ? Boolean(selectedGuest) : Boolean(newGuest.full_name.trim() && newGuest.email.trim())
                        : Boolean(selectedRoom);
                    if (!ready) {
                      toast({ title: "Falta completar este paso", description: "Completá la decisión principal para continuar.", variant: "default" });
                      return;
                    }
                    setMobileStep((step) => step + 1);
                  }}>Siguiente <ChevronRight className="h-4 w-4" /></Button> : <Button
                    type="submit"
                    disabled={submitting}
                    className="min-h-11 flex-1 rounded-xl bg-primary text-primary-foreground shadow-lg sm:w-auto sm:flex-none"
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
                  </Button>}
                </>}
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
