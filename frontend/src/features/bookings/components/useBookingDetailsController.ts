import { useMemo, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/useAuth";
import type { Booking, BookingFrontDeskData, BookingStatus } from "@/types/domain";
import { roleHasCapability } from "@/features/auth/capabilities";
import {
  quickCharges,
  useBookingBillingController,
} from "@/features/bookings/components/useBookingBillingController";
import { useBookingOperationalController } from "@/features/bookings/components/useBookingOperationalController";

type UseBookingDetailsControllerProps = {
  booking: Booking | null;
  isOpen: boolean;
  onUpdateStatus?: (
    id: string,
    status: BookingStatus,
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => Promise<void>;
  onRefreshBooking?: () => Promise<void> | void;
};

export const useBookingDetailsController = ({
  booking,
  isOpen,
  onUpdateStatus,
  onRefreshBooking,
}: UseBookingDetailsControllerProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const refreshBillingDataRef = useRef<(targetBooking?: Booking) => Promise<void>>(async () => {});
  const operational = useBookingOperationalController({
    booking,
    isOpen,
    toast,
    refreshBillingData: (targetBooking?: Booking) => refreshBillingDataRef.current(targetBooking),
    onRefreshBooking,
  });
  const billing = useBookingBillingController({
    bookingState: operational.bookingState,
    isOpen,
    toast,
    onRefreshBooking,
    onBookingTotalDelta: (amountCents) => {
      operational.updateBookingState((current) => ({
        ...current,
        total_price_cents: current.total_price_cents + amountCents,
      }));
    },
  });
  refreshBillingDataRef.current = billing.refreshBillingData;
  const canManageRoomException =
    roleHasCapability(user?.role, "rooms.read") && ["admin", "ops"].includes(user?.role ?? "");
  const canViewAudit = roleHasCapability(user?.role, "audit.events.read");
  const canOverrideCheckoutBalance = roleHasCapability(
    user?.role,
    "bookings.checkout.override",
  );
  const checkoutBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (operational.room?.status !== "Occupied") {
      blockers.push(
        operational.room
          ? `La habitacion debe seguir en Occupied antes de registrar la salida. Estado actual: ${operational.room.status}.`
          : "No se pudo validar el estado actual de la habitacion.",
      );
    }
    if (!operational.checkOutForm.chargesReviewed) blockers.push("Debes revisar cargos y total final antes del checkout.");
    if (!operational.checkOutForm.roomReleaseConfirmed) blockers.push("Debes confirmar que la habitacion fue liberada por el huesped.");
    if (!operational.checkOutForm.housekeepingHandoff) blockers.push("Debes marcar el handoff a housekeeping para dejar la habitacion en limpieza.");
    if (!operational.checkOutForm.paymentPolicy) blockers.push("Debes definir la politica de saldo antes de cerrar la estadia.");
    if (
      operational.checkOutForm.paymentPolicy === "pending-approved" &&
      operational.checkOutForm.closingReference.trim().length < 6
    ) {
      blockers.push("Si dejas saldo pendiente, registra una referencia o motivo operativo.");
    }
    if (operational.checkOutForm.paymentPolicy === "settled" && billing.outstandingAmountCents > 0) {
      blockers.push("Debes registrar el cobro real de la reserva antes del checkout contable.");
    }
    return blockers;
  }, [billing.outstandingAmountCents, operational.checkOutForm, operational.room]);

  const canCompleteFormalCheckOut =
    operational.bookingState?.status === "CheckedIn" && checkoutBlockers.length === 0;

  const nextAction = useMemo(() => {
    const bookingState = operational.bookingState;
    if (!bookingState) {
      return {
        title: "Reserva",
        description: "Sin datos operativos cargados.",
        action: null,
        disabled: true,
        buttonLabel: null,
      };
    }
    if (bookingState.status === "Confirmed") {
      return {
        title: operational.canCompleteFormalCheckIn ? "Lista para check-in" : "Completar recepción de llegada",
        description: operational.canCompleteFormalCheckIn
          ? "La reserva ya validó identidad, contacto, estadía y habitación. Podés abrir el check-in ahora."
          : `Todavía faltan ${operational.checkInBlockers.length} validaciones antes de ocupar la habitación.`,
        action: "check-in" as const,
        disabled: !operational.canCompleteFormalCheckIn,
        buttonLabel: operational.canCompleteFormalCheckIn ? "Registrar check-in" : "Check-in pendiente",
      };
    }
    if (bookingState.status === "CheckedIn" && billing.outstandingAmountCents > 0) {
      return {
        title: "Cobro pendiente antes del checkout",
        description:
          "La estadía sigue activa, pero todavía tiene saldo. Registrá el cobro en la cuenta antes de cerrar la salida.",
        action: null,
        disabled: true,
        buttonLabel: null,
      };
    }
    if (bookingState.status === "CheckedIn") {
      return {
        title: canCompleteFormalCheckOut ? "Lista para checkout" : "Preparar salida del huésped",
        description: canCompleteFormalCheckOut
          ? "La cuenta y el handoff operativo están resueltos. Podés cerrar el checkout formal."
          : `Todavía faltan ${checkoutBlockers.length} controles antes de finalizar la estadía.`,
        action: "check-out" as const,
        disabled: !canCompleteFormalCheckOut,
        buttonLabel: canCompleteFormalCheckOut ? "Registrar checkout" : "Checkout pendiente",
      };
    }
    if (bookingState.status === "CheckedOut") {
      return {
        title: "Estadía cerrada",
        description:
          "La reserva ya terminó. El siguiente paso operativo está en housekeeping para devolver la habitación al inventario.",
        action: null,
        disabled: true,
        buttonLabel: null,
      };
    }
    return {
      title: "Caso fuera de flujo",
      description:
        "La reserva no está en un estado operativo estándar. Revisá datos y auditoría antes de actuar.",
      action: null,
      disabled: true,
      buttonLabel: null,
    };
  }, [
    billing.outstandingAmountCents,
    canCompleteFormalCheckOut,
    checkoutBlockers.length,
    operational.bookingState,
    operational.canCompleteFormalCheckIn,
    operational.checkInBlockers.length,
  ]);

  const handleStatusAction = async (
    nextStatus: BookingStatus,
    explicitFrontDeskPayload?: Partial<BookingFrontDeskData>,
  ) => {
    const bookingState = operational.bookingState;
    if (!bookingState || !onUpdateStatus) return;

    if (nextStatus === "CheckedIn" && operational.room?.status !== "Available") {
      toast({
        title: "Check-in bloqueado",
        description: "La habitacion debe estar disponible antes de registrar la llegada.",
        variant: "error",
      });
      return;
    }
    if (nextStatus === "CheckedIn" && operational.checkInBlockers.length > 0) {
      toast({
        title: "Check-in incompleto",
        description: "Completa el checklist operativo antes de registrar la llegada.",
        variant: "error",
      });
      return;
    }
    if (nextStatus === "CheckedOut" && checkoutBlockers.length > 0) {
      toast({
        title: "Checkout incompleto",
        description: "Cierra la cuenta y completa el checklist operativo antes de finalizar la estadia.",
        variant: "error",
      });
      return;
    }

    operational.setStatusLoading(nextStatus);
    try {
      const frontDeskPayload =
        explicitFrontDeskPayload ??
        (nextStatus === "CheckedIn"
          ? {
              check_in_guests_count: operational.guestsCountValue,
              check_in_reference: operational.checkInForm.arrivalReference.trim() || undefined,
              check_in_document_verified: operational.checkInForm.documentVerified,
              check_in_contact_confirmed: operational.checkInForm.contactConfirmed,
              check_in_stay_confirmed: operational.checkInForm.stayConfirmed,
            }
          : nextStatus === "CheckedOut"
            ? {
                check_out_payment_policy: operational.checkOutForm.paymentPolicy,
                check_out_reference: operational.checkOutForm.closingReference.trim() || undefined,
                check_out_charges_reviewed: operational.checkOutForm.chargesReviewed,
                check_out_room_release_confirmed: operational.checkOutForm.roomReleaseConfirmed,
                check_out_housekeeping_handoff: operational.checkOutForm.housekeepingHandoff,
              }
            : undefined);

      await onUpdateStatus(bookingState.id, nextStatus, frontDeskPayload);
      const updatedBooking = {
        ...bookingState,
        status: nextStatus,
        operational_data: {
          ...(bookingState.operational_data ?? {}),
          ...(frontDeskPayload ?? {}),
        },
      };
      operational.updateBookingState(() => updatedBooking);
      operational.setAuditRefreshTick((current) => current + 1);
      await operational.refreshOperationalData(updatedBooking);
    } finally {
      operational.setStatusLoading(null);
    }
  };

  const handleQuickCharge = async (label: string, amount_cents: number, category: string) => {
    await billing.handleQuickCharge(label, amount_cents, category);
  };

  return {
    bookingState: operational.bookingState,
    room: operational.room,
    roomOptions: operational.roomOptions,
    extraCharges: billing.extraCharges,
    invoice: billing.invoice,
    payments: billing.payments,
    loading: operational.loading,
    loadingCharges: billing.loadingCharges,
    statusLoading: operational.statusLoading,
    roomOptionsLoading: operational.roomOptionsLoading,
    reassignmentLoading: operational.reassignmentLoading,
    auditRefreshTick: operational.auditRefreshTick,
    settlementLoading: billing.settlementLoading,
    selectedRoomId: operational.selectedRoomId,
    reassignmentReason: operational.reassignmentReason,
    paymentMethod: billing.paymentMethod,
    paymentAmount: billing.paymentAmount,
    paymentReference: billing.paymentReference,
    paymentNote: billing.paymentNote,
    checkInForm: operational.checkInForm,
    checkOutForm: operational.checkOutForm,
    nights: operational.nights,
    extrasTotal: billing.extrasTotal,
    accommodationTotal: billing.accommodationTotal,
    outstandingAmountCents: billing.outstandingAmountCents,
    statusMeta: operational.statusMeta,
    canManageRoomException,
    canViewAudit,
    canOverrideCheckoutBalance,
    guestsCountValue: operational.guestsCountValue,
    checkInBlockers: operational.checkInBlockers,
    canCompleteFormalCheckIn: operational.canCompleteFormalCheckIn,
    checkoutBlockers,
    canCompleteFormalCheckOut,
    nextAction,
    reassignmentBlockers: operational.reassignmentBlockers,
    warningBanner: operational.warningBanner,
    footerRoom: operational.footerRoom,
    quickCharges,
    setSelectedRoomId: operational.setSelectedRoomId,
    setReassignmentReason: operational.setReassignmentReason,
    setPaymentMethod: billing.setPaymentMethod,
    setPaymentAmount: billing.setPaymentAmount,
    setPaymentReference: billing.setPaymentReference,
    setPaymentNote: billing.setPaymentNote,
    updateCheckInForm: operational.updateCheckInForm,
    updateCheckOutForm: operational.updateCheckOutForm,
    refreshOperationalData: operational.refreshOperationalData,
    handleRegisterPayment: billing.handleRegisterPayment,
    handleRoomReassignment: operational.handleRoomReassignment,
    handleQuickCharge,
    handleStatusAction,
  };
};
