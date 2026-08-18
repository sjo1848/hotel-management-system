import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Clock3,
  Receipt,
  XCircle,
} from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { getErrorMessage } from "@/api/errors";
import type {
  Booking,
  BookingStatus,
  Room,
} from "@/types/domain";
import roomService from "@/features/rooms/services/roomService";
import {
  BookingCheckInFormState,
  BookingCheckOutFormState,
} from "@/features/bookings/components/BookingDetailsSections";
import { updateBooking } from "@/features/bookings/services/bookingService";

type ToastApi = {
  title: string;
  description: string;
  variant: "success" | "error";
};

type UseBookingOperationalControllerProps = {
  booking: Booking | null;
  isOpen: boolean;
  roomOptionsEnabled?: boolean;
  toast: (payload: ToastApi) => void;
  refreshBillingData: (targetBooking?: Booking) => Promise<void>;
  onRefreshBooking?: () => Promise<void> | void;
};

export const useBookingOperationalController = ({
  booking,
  isOpen,
  roomOptionsEnabled = true,
  toast,
  refreshBillingData,
  onRefreshBooking,
}: UseBookingOperationalControllerProps) => {
  const [bookingState, setBookingState] = useState<Booking | null>(booking);
  const [room, setRoom] = useState<Room | null>(booking?.room ?? null);
  const [roomOptions, setRoomOptions] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<BookingStatus | null>(null);
  const [roomOptionsLoading, setRoomOptionsLoading] = useState(false);
  const [reassignmentLoading, setReassignmentLoading] = useState(false);
  const [auditRefreshTick, setAuditRefreshTick] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [reassignmentReason, setReassignmentReason] = useState("");
  const roomOptionsBookingIdRef = useRef<string | null>(null);
  const roomRequestIdRef = useRef(0);
  const roomOptionsRequestIdRef = useRef(0);
  const operationalRefreshIdRef = useRef(0);
  const activeBookingIdRef = useRef<string | null>(booking?.id ?? null);

  if (activeBookingIdRef.current !== (booking?.id ?? null)) {
    activeBookingIdRef.current = booking?.id ?? null;
    operationalRefreshIdRef.current += 1;
  }
  const [checkInForm, setCheckInForm] = useState<BookingCheckInFormState>({
    documentVerified: false,
    stayConfirmed: false,
    contactConfirmed: false,
    guestsCount: "1",
    arrivalReference: "",
  });
  const [checkOutForm, setCheckOutForm] = useState<BookingCheckOutFormState>({
    chargesReviewed: false,
    roomReleaseConfirmed: false,
    housekeepingHandoff: false,
    paymentPolicy: "" as "" | "settled" | "pending-approved",
    closingReference: "",
  });

  useEffect(() => {
    setBookingState(booking);
  }, [booking]);

  useEffect(() => {
    const requestId = ++roomRequestIdRef.current;
    if (!bookingState || !isOpen) {
      setRoom(null);
      setRoomOptions([]);
      return;
    }

    setLoading(true);
    roomService.getRoomById(bookingState.room_id).then((data) => {
      if (roomRequestIdRef.current === requestId) setRoom(data);
    }).finally(() => {
      if (roomRequestIdRef.current === requestId) setLoading(false);
    });
  }, [bookingState?.id, bookingState?.room_id, isOpen]);

  useEffect(() => {
    const requestId = ++roomOptionsRequestIdRef.current;
    if (!isOpen || !bookingState || bookingState.status === "Cancelled" || bookingState.status === "NoShow" || bookingState.status === "CheckedOut") {
      setRoomOptions([]);
      setSelectedRoomId("");
      setReassignmentReason("");
      return;
    }
    if (!roomOptionsEnabled) return;

    roomOptionsBookingIdRef.current = bookingState.id;
    setRoomOptions([]);
    setSelectedRoomId("");
    setReassignmentReason("");
    setRoomOptionsLoading(true);
    roomService
      .getAllRooms(bookingState.check_in, bookingState.check_out)
      .then((rooms) => {
        if (roomOptionsRequestIdRef.current !== requestId) return;
        const availableAlternatives = rooms.filter((candidate) => candidate.id !== bookingState.room_id);
        setRoomOptions(availableAlternatives);
        setSelectedRoomId((current) =>
          current && availableAlternatives.some((candidate) => candidate.id === current)
            ? current
            : availableAlternatives[0]?.id ?? "",
        );
      })
      .catch(() => {
        if (roomOptionsRequestIdRef.current !== requestId) return;
        setRoomOptions([]);
        setSelectedRoomId("");
      })
      .finally(() => {
        if (roomOptionsRequestIdRef.current === requestId) setRoomOptionsLoading(false);
      });
  }, [bookingState?.check_in, bookingState?.check_out, bookingState?.id, bookingState?.room_id, bookingState?.status, isOpen, roomOptionsEnabled]);

  useEffect(() => {
    if (!isOpen || !bookingState) {
      setCheckInForm({
        documentVerified: false,
        stayConfirmed: false,
        contactConfirmed: false,
        guestsCount: "1",
        arrivalReference: "",
      });
      setCheckOutForm({
        chargesReviewed: false,
        roomReleaseConfirmed: false,
        housekeepingHandoff: false,
        paymentPolicy: "",
        closingReference: "",
      });
      return;
    }

    setCheckInForm({
      documentVerified:
        bookingState.operational_data?.check_in_document_verified ??
        bookingState.status !== "Confirmed",
      stayConfirmed:
        bookingState.operational_data?.check_in_stay_confirmed ??
        bookingState.status !== "Confirmed",
      contactConfirmed:
        bookingState.operational_data?.check_in_contact_confirmed ??
        bookingState.status !== "Confirmed",
      guestsCount: String(bookingState.operational_data?.check_in_guests_count ?? 1),
      arrivalReference: bookingState.operational_data?.check_in_reference ?? "",
    });
    setCheckOutForm({
      chargesReviewed:
        bookingState.operational_data?.check_out_charges_reviewed ??
        bookingState.status === "CheckedOut",
      roomReleaseConfirmed:
        bookingState.operational_data?.check_out_room_release_confirmed ??
        bookingState.status === "CheckedOut",
      housekeepingHandoff:
        bookingState.operational_data?.check_out_housekeeping_handoff ??
        bookingState.status === "CheckedOut",
      paymentPolicy:
        (bookingState.operational_data?.check_out_payment_policy as
          | ""
          | "settled"
          | "pending-approved"
          | undefined) ?? (bookingState.status === "CheckedOut" ? "settled" : ""),
      closingReference: bookingState.operational_data?.check_out_reference ?? "",
    });
  }, [bookingState?.id, bookingState?.operational_data, bookingState?.status, isOpen]);

  const nights = useMemo(() => {
    if (!bookingState) return 0;
    return Math.max(
      1,
      differenceInCalendarDays(parseISO(bookingState.check_out), parseISO(bookingState.check_in)),
    );
  }, [bookingState]);

  const statusMeta = useMemo(() => {
    switch (bookingState?.status) {
      case "Confirmed":
        return {
          label: "Confirmada",
          icon: Clock3,
          badge: "border-primary/20 bg-primary/10 text-primary",
          hint: "Lista para check-in",
        };
      case "CheckedIn":
        return {
          label: "En casa",
          icon: CheckCircle2,
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
          hint: "Estadia activa",
        };
      case "CheckedOut":
        return {
          label: "Finalizada",
          icon: Receipt,
          badge: "border-border bg-muted text-muted-foreground",
          hint: "Cuenta cerrada",
        };
      case "Cancelled":
        return {
          label: "Cancelada",
          icon: XCircle,
          badge: "border-destructive/20 bg-destructive/10 text-destructive",
          hint: "Sin ocupacion",
        };
      case "NoShow":
        return {
          label: "No-show",
          icon: XCircle,
          badge: "border-amber-500/20 bg-amber-500/10 text-amber-800",
          hint: "Llegada no presentada",
        };
      default:
        return {
          label: "Reserva",
          icon: Clock3,
          badge: "bg-muted text-muted-foreground border-border",
          hint: "Sin clasificacion",
        };
    }
  }, [bookingState?.status]);

  const guestsCountValue = Number.parseInt(checkInForm.guestsCount, 10);
  const hasValidGuestsCount = Number.isFinite(guestsCountValue) && guestsCountValue > 0;

  const checkInBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (room?.status !== "Available") {
      blockers.push(
        room
          ? `La habitacion esta en ${room.status} y no puede ocuparse todavia.`
          : "No se pudo validar el estado actual de la habitacion.",
      );
    }
    if (!bookingState?.guest_name.trim()) blockers.push("La reserva no tiene huesped identificado.");
    if (!hasValidGuestsCount) blockers.push("Debes confirmar la cantidad final de huespedes.");
    if (!checkInForm.documentVerified) blockers.push("Debes confirmar identidad o documento en recepcion.");
    if (!checkInForm.stayConfirmed) blockers.push("Debes confirmar fechas y condiciones de estadia con el huesped.");
    if (!checkInForm.contactConfirmed) blockers.push("Debes confirmar que el contacto del huesped fue verificado.");
    return blockers;
  }, [bookingState?.guest_name, checkInForm, hasValidGuestsCount, room]);

  const canCompleteFormalCheckIn =
    bookingState?.status === "Confirmed" && checkInBlockers.length === 0;

  const reassignmentBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!bookingState) {
      blockers.push("La reserva no esta disponible para reasignacion.");
      return blockers;
    }
    if (!selectedRoomId) blockers.push("No hay una habitacion alternativa seleccionada.");
    const optionsMatchBooking = roomOptionsBookingIdRef.current === bookingState.id;
    if (!optionsMatchBooking || roomOptions.length === 0) blockers.push("No hay habitaciones disponibles para reasignar en este rango.");
    if (bookingState.status === "CheckedIn" && reassignmentReason.trim().length < 6) {
      blockers.push("Para mover una estadia activa, registra un motivo operativo o de excepcion.");
    }
    return blockers;
  }, [bookingState, reassignmentReason, roomOptions.length, selectedRoomId]);

  const refreshOperationalData = async (targetBooking?: Booking) => {
    const currentBooking = targetBooking ?? bookingState;
    if (!currentBooking) return;
    const requestId = ++operationalRefreshIdRef.current;
    const targetBookingId = currentBooking.id;
    const isCurrentRefresh = () =>
      operationalRefreshIdRef.current === requestId &&
      activeBookingIdRef.current === targetBookingId;
    setLoading(true);
    try {
      const roomData = await roomService.getRoomById(currentBooking.room_id);
      if (!isCurrentRefresh()) return;
      setRoom(roomData);
      await refreshBillingData(currentBooking);
      if (!isCurrentRefresh()) return;
      await onRefreshBooking?.();
    } finally {
      if (isCurrentRefresh()) setLoading(false);
    }
  };

  const handleRoomReassignment = async () => {
    if (!bookingState) return;
    if (reassignmentBlockers.length > 0) {
      toast({
        title: "Reasignacion incompleta",
        description: reassignmentBlockers[0],
        variant: "error",
      });
      return;
    }

    setReassignmentLoading(true);
    try {
      const updated = await updateBooking(bookingState.id, {
        room_id: selectedRoomId,
        operational_note: reassignmentReason.trim() || undefined,
      });
      setBookingState(updated);
      setRoom(roomOptions.find((candidate) => candidate.id === updated.room_id) ?? null);
      setReassignmentReason("");
      toast({
        title: "Habitacion reasignada",
        description:
          updated.status === "CheckedIn"
            ? "La nueva habitacion quedo ocupada y la anterior paso a limpieza."
            : "La reserva quedo reasignada a una nueva habitacion.",
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      await refreshOperationalData(updated);
    } catch (error: unknown) {
      toast({
        title: "No se pudo mover la reserva",
        description: getErrorMessage(error, "Revisa disponibilidad y reintenta."),
        variant: "error",
      });
    } finally {
      setReassignmentLoading(false);
    }
  };

  const updateCheckInForm = (patch: Partial<BookingCheckInFormState>) => {
    setCheckInForm((current) => ({ ...current, ...patch }));
  };

  const updateCheckOutForm = (patch: Partial<BookingCheckOutFormState>) => {
    setCheckOutForm((current) => ({ ...current, ...patch }));
  };

  const updateBookingState = (updater: (current: Booking) => Booking) => {
    setBookingState((current) => (current ? updater(current) : current));
  };

  const warningBanner =
    room && room.status !== "Available" && bookingState?.status === "Confirmed"
      ? {
          icon: AlertTriangle,
          title: "Check-in bloqueado por estado de habitacion",
          description: `La reserva esta confirmada, pero la habitacion se encuentra en ${room.status}.`,
        }
      : null;

  const footerRoom = room
    ? {
        icon: BedDouble,
        label: room.room_number,
      }
    : null;

  return {
    bookingState,
    room,
    roomOptions: roomOptionsBookingIdRef.current === bookingState?.id ? roomOptions : [],
    loading,
    statusLoading,
    roomOptionsLoading,
    reassignmentLoading,
    auditRefreshTick,
    selectedRoomId: roomOptionsBookingIdRef.current === bookingState?.id ? selectedRoomId : "",
    reassignmentReason: roomOptionsBookingIdRef.current === bookingState?.id ? reassignmentReason : "",
    checkInForm,
    checkOutForm,
    nights,
    statusMeta,
    guestsCountValue,
    checkInBlockers,
    canCompleteFormalCheckIn,
    reassignmentBlockers,
    warningBanner,
    footerRoom,
    setSelectedRoomId,
    setReassignmentReason,
    updateCheckInForm,
    updateCheckOutForm,
    refreshOperationalData,
    handleRoomReassignment,
    updateBookingState,
    setStatusLoading,
    setAuditRefreshTick,
  };
};
