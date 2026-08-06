import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  Booking,
  BookingFrontDeskData,
  BookingStatus,
} from "@/types/domain";
import AuditTimeline from "@/features/audit/components/AuditTimeline";
import { useGuidedMode } from "@/features/guided/GuidedModeContext";
import GuideHint from "@/features/guided/components/GuideHint";
import {
  BookingAccountSection,
  BookingCheckInSection,
  BookingCheckOutSection,
  BookingGuestStaySection,
  BookingReassignmentSection,
  BookingSummaryMetrics,
} from "@/features/bookings/components/BookingDetailsSections";
import { useBookingDetailsController } from "@/features/bookings/components/useBookingDetailsController";
import BookingArrivalExceptionActions from "@/features/bookings/components/BookingArrivalExceptionActions";
import {
  BookingCaseTabs,
  type BookingCaseTab,
} from "@/features/bookings/components/BookingCaseTabs";
import type { ReceptionGuideStepId } from "@/features/guided/receptionGuide";

export interface BookingCaseWorkspaceProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose?: () => void;
  onUpdateStatus?: (
    id: string,
    status: BookingStatus,
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => Promise<void>;
  onEditBooking?: () => void;
  onRefreshBooking?: () => Promise<void> | void;
  queueBookingIds?: string[];
  onOpenQueuedBooking?: (bookingId: string) => void;
  guidedFocusStep?: ReceptionGuideStepId | null;
  titleId?: string;
}

const guideTargetByStep: Partial<Record<ReceptionGuideStepId, string>> = {
  "review-case": "reception-guide-review",
  "check-in": "reception-guide-check-in",
  payment: "reception-guide-payment",
  checkout: "reception-guide-checkout",
};

const tabByGuideStep: Partial<Record<ReceptionGuideStepId, BookingCaseTab>> = {
  "review-case": "summary",
  "check-in": "operation",
  payment: "account",
  checkout: "operation",
};

const focusGuideTarget = (step: ReceptionGuideStepId) => {
  const targetId = guideTargetByStep[step];
  if (!targetId) return null;
  return window.setTimeout(() => {
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }, 0);
};

const BookingCaseWorkspace = ({
  booking,
  isOpen,
  onClose,
  onUpdateStatus,
  onEditBooking,
  onRefreshBooking,
  queueBookingIds = [],
  onOpenQueuedBooking,
  guidedFocusStep = null,
  titleId,
}: BookingCaseWorkspaceProps) => {
  const {
    bookingState,
    room,
    roomOptions,
    extraCharges,
    invoice,
    payments,
    loadingCharges,
    statusLoading,
    roomOptionsLoading,
    reassignmentLoading,
    auditRefreshTick,
    settlementLoading,
    selectedRoomId,
    reassignmentReason,
    paymentMethod,
    paymentAmount,
    paymentReference,
    paymentNote,
    checkInForm,
    checkOutForm,
    nights,
    extrasTotal,
    accommodationTotal,
    outstandingAmountCents,
    statusMeta,
    canManageRoomException,
    canViewAudit,
    canOverrideCheckoutBalance,
    checkInBlockers,
    canCompleteFormalCheckIn,
    checkoutBlockers,
    canCompleteFormalCheckOut,
    nextAction,
    reassignmentBlockers,
    warningBanner,
    footerRoom,
    quickCharges,
    setSelectedRoomId,
    setReassignmentReason,
    setPaymentMethod,
    setPaymentAmount,
    setPaymentReference,
    setPaymentNote,
    updateCheckInForm,
    updateCheckOutForm,
    refreshOperationalData,
    handleRegisterPayment,
    handleRoomReassignment,
    handleQuickCharge,
    handleStatusAction,
  } = useBookingDetailsController({
    booking,
    isOpen,
    onUpdateStatus,
    onRefreshBooking,
  });
  const { enabled: guidedModeEnabled, getReceptionGuideState, trackReceptionEvent } = useGuidedMode();
  const [activeTab, setActiveTab] = useState<BookingCaseTab>("summary");

  useEffect(() => {
    setActiveTab("summary");
  }, [bookingState?.id]);

  useEffect(() => {
    if (!isOpen || !guidedFocusStep) return;
    const tab = tabByGuideStep[guidedFocusStep];
    if (tab) setActiveTab(tab);
    const frame = focusGuideTarget(guidedFocusStep);
    return () => {
      if (frame !== null) window.clearTimeout(frame);
    };
  }, [bookingState?.id, guidedFocusStep, isOpen]);

  if (!bookingState) return null;
  const guideState = getReceptionGuideState(bookingState.status);

  const StatusIcon = statusMeta.icon;
  const normalizedQueueBookingIds = Array.from(new Set(queueBookingIds));
  const currentQueueIndex = normalizedQueueBookingIds.indexOf(bookingState.id);
  const hasQueueSession = currentQueueIndex >= 0 && normalizedQueueBookingIds.length > 1;
  const previousQueueBookingId =
    hasQueueSession && currentQueueIndex > 0
      ? normalizedQueueBookingIds[currentQueueIndex - 1]
      : null;
  const nextQueueBookingId =
    hasQueueSession && currentQueueIndex < normalizedQueueBookingIds.length - 1
      ? normalizedQueueBookingIds[currentQueueIndex + 1]
      : null;
  const pendingControlCount =
    bookingState.status === "Confirmed"
      ? checkInBlockers.length
      : bookingState.status === "CheckedIn"
        ? checkoutBlockers.length
        : 0;

  const handleGuidedStatusAction = async (
    status: BookingStatus,
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => {
    await handleStatusAction(status, frontDesk);
    if (status === "CheckedIn") {
      trackReceptionEvent("checkin_complete");
    }
    if (status === "CheckedOut") {
      trackReceptionEvent("checkout_complete");
    }
  };

  const handleGuidedRegisterPayment = async () => {
    await handleRegisterPayment();
    trackReceptionEvent("payment_registered");
  };

  const navigateToTab = (tab: BookingCaseTab, guideStep?: ReceptionGuideStepId) => {
    setActiveTab(tab);
    if (guideStep) {
      focusGuideTarget(guideStep);
    }
  };

  let primaryAction: { label: string; disabled?: boolean; onClick?: () => void } | null = null;
  if (bookingState.status === "Confirmed") {
    if (canCompleteFormalCheckIn) {
      primaryAction = {
        label: "Registrar check-in",
        disabled: statusLoading === "Confirmed",
        onClick: () => {
          void handleGuidedStatusAction("CheckedIn");
        },
      };
    } else {
      primaryAction = {
        label: "Completar checklist de llegada",
        onClick: () => navigateToTab("operation", "check-in"),
      };
    }
  } else if (bookingState.status === "CheckedIn") {
    if (outstandingAmountCents > 0) {
      primaryAction = {
        label: "Registrar cobro",
        onClick: () => navigateToTab("account", "payment"),
      };
    } else if (canCompleteFormalCheckOut) {
      primaryAction = {
        label: "Registrar checkout",
        disabled: statusLoading === "CheckedIn",
        onClick: () => {
          void handleGuidedStatusAction("CheckedOut");
        },
      };
    } else {
      primaryAction = {
        label: "Completar checklist de salida",
        onClick: () => navigateToTab("operation", "checkout"),
      };
    }
  } else if (bookingState.status === "CheckedOut") {
    primaryAction = nextQueueBookingId
      ? {
          label: "Continuar con siguiente caso",
          onClick: () => onOpenQueuedBooking?.(nextQueueBookingId),
        }
      : { label: "Estadía cerrada", disabled: true };
  } else {
    primaryAction = { label: nextAction.title, disabled: true };
  }

  return (
    <>
      <SheetHeader className="border-b px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Badge className={cn("inline-flex items-center gap-1.5 border px-3 py-1", statusMeta.badge)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusMeta.label}
            </Badge>
            <div>
              <h2 id={titleId} className="pr-8 text-2xl font-black tracking-tight">
                {bookingState.guest_name}
              </h2>
              <p className="mt-2 max-w-[58ch] text-sm text-muted-foreground">
                Hab. {room?.room_number ?? bookingState.room_id.slice(0, 6)} · Reserva {bookingState.id.slice(0, 8).toUpperCase()} · Revisá el bloqueo y completá una sola próxima acción.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:min-w-[220px]">
            {hasQueueSession ? (
              <div className="motion-live-pill rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                  Cola del turno
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Caso {currentQueueIndex + 1} de {normalizedQueueBookingIds.length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quedan {normalizedQueueBookingIds.length - currentQueueIndex - 1} después de este caso.
                </p>
              </div>
            ) : null}
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 shadow-sm",
                pendingControlCount > 0
                  ? "border-amber-500/20 bg-amber-500/10"
                  : "border-primary/20 bg-primary/10",
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Próxima acción
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {nextAction.title}
              </p>
              {pendingControlCount > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {pendingControlCount} control(es) pendiente(s)
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div key={bookingState.id} className="motion-queue-step min-h-0 flex-1 overflow-y-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        {guidedModeEnabled ? (
          <GuideHint
            eyebrow="Misión guiada"
            title={guideState.summary.title}
            description={guideState.summary.description}
            ctaLabel={
              bookingState.status === "Confirmed"
                ? "Ir al checklist de llegada"
                : bookingState.status === "CheckedIn" && outstandingAmountCents > 0
                  ? "Ir a la cuenta"
                  : bookingState.status === "CheckedIn"
                    ? "Ir al checklist de salida"
                    : undefined
            }
            onCta={
              bookingState.status === "Confirmed"
                ? () => navigateToTab("operation", "check-in")
                : bookingState.status === "CheckedIn" && outstandingAmountCents > 0
                  ? () => navigateToTab("account", "payment")
                  : bookingState.status === "CheckedIn"
                    ? () => navigateToTab("operation", "checkout")
                    : undefined
            }
          />
        ) : null}

        <BookingCaseTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          operationCount={pendingControlCount}
          accountAttention={outstandingAmountCents > 0}
          summary={
            <div className="space-y-6">
              <div
                id="reception-guide-review"
                tabIndex={-1}
                className={cn(
                  "scroll-mt-6 rounded-3xl outline-none transition-shadow",
                  guidedFocusStep === "review-case" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                )}
              >
                <BookingSummaryMetrics booking={bookingState} room={room} nights={nights} />
              </div>
              <BookingGuestStaySection booking={bookingState} room={room} />
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Próxima acción
                </p>
                <p className="mt-2 font-semibold text-foreground">{nextAction.title}</p>
                {nextAction.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{nextAction.description}</p>
                ) : null}
                {pendingControlCount > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                    {pendingControlCount} control(es) operativo(s) pendiente(s) en la pestaña Operación.
                  </p>
                ) : null}
              </div>
            </div>
          }
          operation={
            <div className="space-y-6">
              {warningBanner ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <warningBanner.icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">{warningBanner.title}</p>
                        <p className="mt-1 text-xs">{warningBanner.description}</p>
                        <p className="mt-2 text-xs font-semibold">
                          {canManageRoomException
                            ? "Elegí una habitación alternativa en la sección siguiente o actualizá el estado."
                            : "Pedí a Operaciones que libere o reasigne la habitación y después actualizá el estado."}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 rounded-xl border-amber-500/30 bg-card text-foreground"
                      onClick={() => {
                        void refreshOperationalData();
                      }}
                    >
                      Actualizar estado
                    </Button>
                  </div>
                </div>
              ) : null}

              {bookingState.status === "Confirmed" ? (
                <div
                  id="reception-guide-check-in"
                  tabIndex={-1}
                  className={cn(
                    "scroll-mt-6 rounded-3xl outline-none transition-shadow",
                    guidedFocusStep === "check-in" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                  )}
                >
                  <BookingCheckInSection
                    form={checkInForm}
                    checkInBlockers={checkInBlockers}
                    canCompleteFormalCheckIn={canCompleteFormalCheckIn}
                    statusLoading={statusLoading}
                    onFormChange={updateCheckInForm}
                    onStatusAction={(status) => {
                      void handleGuidedStatusAction(status);
                    }}
                  />
                </div>
              ) : null}

              {bookingState.status === "CheckedIn" ? (
                <div
                  id="reception-guide-checkout"
                  tabIndex={-1}
                  className={cn(
                    "scroll-mt-6 rounded-3xl outline-none transition-shadow",
                    guidedFocusStep === "checkout" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
                  )}
                >
                  <BookingCheckOutSection
                    form={checkOutForm}
                    checkoutBlockers={checkoutBlockers}
                    canCompleteFormalCheckOut={canCompleteFormalCheckOut}
                    statusLoading={statusLoading}
                    outstandingAmountCents={outstandingAmountCents}
                    canOverrideCheckoutBalance={canOverrideCheckoutBalance}
                    onFormChange={updateCheckOutForm}
                    onStatusAction={(status) => {
                      void handleGuidedStatusAction(status);
                    }}
                  />
                </div>
              ) : null}

              {canManageRoomException && bookingState.status !== "CheckedOut" && bookingState.status !== "Cancelled" && bookingState.status !== "NoShow" ? (
                <BookingReassignmentSection
                  booking={bookingState}
                  roomOptionsLoading={roomOptionsLoading}
                  roomOptions={roomOptions}
                  selectedRoomId={selectedRoomId}
                  reassignmentReason={reassignmentReason}
                  reassignmentBlockers={reassignmentBlockers}
                  reassignmentLoading={reassignmentLoading}
                  onSelectRoom={setSelectedRoomId}
                  onReasonChange={setReassignmentReason}
                  onSubmit={() => {
                    void handleRoomReassignment();
                  }}
                />
              ) : null}

              {bookingState.status === "Confirmed" ? (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Acciones de excepción
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cancelación, no-show y llegada tardía se registran acá y quedan auditadas.
                  </p>
                  <div className="mt-3">
                    <BookingArrivalExceptionActions
                      booking={bookingState}
                      statusLoading={statusLoading}
                      onAction={(status, frontDesk) => {
                        void handleGuidedStatusAction(status, frontDesk);
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          }
          account={
            <div
              id="reception-guide-payment"
              tabIndex={-1}
              className={cn(
                "scroll-mt-6 rounded-3xl outline-none transition-shadow",
                guidedFocusStep === "payment" && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
              )}
            >
              <BookingAccountSection
                booking={bookingState}
                accommodationTotal={accommodationTotal}
                extrasTotal={extrasTotal}
                loadingCharges={loadingCharges}
                quickCharges={quickCharges}
                onQuickCharge={(label, amountCents, category) => {
                  void handleQuickCharge(label, amountCents, category);
                }}
                outstandingAmountCents={outstandingAmountCents}
                paymentMethod={paymentMethod}
                paymentAmount={paymentAmount}
                paymentReference={paymentReference}
                paymentNote={paymentNote}
                settlementLoading={settlementLoading}
                invoice={invoice}
                payments={payments}
                extraCharges={extraCharges}
                onPaymentMethodChange={setPaymentMethod}
                onPaymentAmountChange={setPaymentAmount}
                onPaymentReferenceChange={setPaymentReference}
                onPaymentNoteChange={setPaymentNote}
                onRegisterPayment={() => {
                  void handleGuidedRegisterPayment();
                }}
              />
            </div>
          }
          history={
            canViewAudit ? (
              <AuditTimeline
                title="Auditoria de reserva"
                description="Check-in, checkout, cancelaciones y excepciones visibles para supervision."
                entityIds={[bookingState.id, bookingState.room_id]}
                refreshSignal={`${bookingState.id}:${bookingState.room_id}:${bookingState.status}:${auditRefreshTick}`}
                emptyMessage="Todavia no hay eventos de auditoria vinculados a esta reserva."
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                No tenés permisos para ver la auditoría de esta reserva.
              </div>
            )
          }
        />
      </div>

      <SheetFooter className="border-t bg-card/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
        <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <Button
            variant="outline"
            className="w-full rounded-xl lg:w-auto"
            onClick={() => {
              void refreshOperationalData();
            }}
          >
            <CalendarDays className="h-4 w-4" />
            Refrescar
          </Button>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
            {primaryAction ? (
              <Button
                variant={primaryAction.disabled ? "outline" : "default"}
                className="min-w-0 w-full whitespace-normal rounded-xl leading-snug sm:w-auto"
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            ) : null}
            {hasQueueSession ? (
              <>
                <Button
                  variant="outline"
                  className="w-full rounded-xl sm:w-auto"
                  disabled={!previousQueueBookingId}
                  onClick={() => {
                    if (previousQueueBookingId) {
                      onOpenQueuedBooking?.(previousQueueBookingId);
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Caso anterior
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl sm:w-auto"
                  disabled={!nextQueueBookingId}
                  onClick={() => {
                    if (nextQueueBookingId) {
                      onOpenQueuedBooking?.(nextQueueBookingId);
                    }
                  }}
                >
                  Continuar con siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            {onEditBooking ? (
              <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={onEditBooking}>
                Editar reserva
              </Button>
            ) : null}
            {footerRoom ? (
              <Button variant="outline" className="w-full rounded-xl sm:w-auto" disabled>
                <footerRoom.icon className="h-4 w-4" />
                {footerRoom.label}
              </Button>
            ) : null}
            <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </SheetFooter>
    </>
  );
};

export default BookingCaseWorkspace;
