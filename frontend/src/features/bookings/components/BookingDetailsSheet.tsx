import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  BookingNextActionBanner,
  BookingReassignmentSection,
  BookingSidebarPanels,
  BookingSummaryMetrics,
} from "@/features/bookings/components/BookingDetailsSections";
import { useBookingDetailsController } from "@/features/bookings/components/useBookingDetailsController";

interface BookingDetailsSheetProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (
    id: string,
    status: BookingStatus,
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => Promise<void>;
  onEditBooking?: () => void;
  onRefreshBooking?: () => Promise<void> | void;
  queueBookingIds?: string[];
  onOpenQueuedBooking?: (bookingId: string) => void;
}

const BookingDetailsSheet = ({
  booking,
  isOpen,
  onClose,
  onUpdateStatus,
  onEditBooking,
  onRefreshBooking,
  queueBookingIds = [],
  onOpenQueuedBooking,
}: BookingDetailsSheetProps) => {
  const {
    bookingState,
    room,
    roomOptions,
    extraCharges,
    invoice,
    payments,
    loading,
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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-hidden border-l border-border bg-card p-0 sm:max-w-[760px]">
        <div className="flex min-h-0 flex-1 flex-col">
        <SheetHeader className="border-b px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Badge className={cn("inline-flex items-center gap-1.5 border px-3 py-1", statusMeta.badge)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusMeta.label}
              </Badge>
              <div>
                <SheetTitle className="text-2xl font-black tracking-tight">
                  Reserva {bookingState.id.slice(0, 8).toUpperCase()}
                </SheetTitle>
                <SheetDescription className="mt-2 max-w-[58ch] text-sm">
                  Centro operativo de la estadia. Desde aca recepcion puede revisar huesped, cuenta, estado de la habitacion y ejecutar acciones criticas.
                </SheetDescription>
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
                    Avanzá por la selección operativa sin volver al board.
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Proximo paso
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {nextAction.title}
                </p>
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
                nextAction.action === "check-in"
                  ? "Registrar check-in"
                  : nextAction.action === "check-out"
                    ? "Registrar checkout"
                    : undefined
              }
              onCta={
                nextAction.action === "check-in"
                  ? () => {
                      void handleGuidedStatusAction("CheckedIn");
                    }
                  : nextAction.action === "check-out"
                    ? () => {
                        void handleGuidedStatusAction("CheckedOut");
                      }
                    : undefined
              }
            />
          ) : null}
          <BookingSummaryMetrics booking={bookingState} room={room} nights={nights} />

          <BookingNextActionBanner
            nextAction={nextAction}
            statusLoading={statusLoading}
            onStatusAction={(status) => {
              void handleGuidedStatusAction(status);
            }}
          />

          {warningBanner ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <warningBanner.icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{warningBanner.title}</p>
                  <p className="mt-1 text-xs">{warningBanner.description}</p>
                </div>
              </div>
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-6">
              <BookingGuestStaySection booking={bookingState} room={room} />

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
              ) : null}

              {bookingState.status === "CheckedIn" ? (
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
              ) : null}

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

            <div className="space-y-6">
              <BookingSidebarPanels
                booking={bookingState}
                room={room}
                loading={loading}
                invoice={invoice}
                statusLoading={statusLoading}
                onEditBooking={onEditBooking}
                onStatusAction={(status, frontDesk) => {
                  void handleGuidedStatusAction(status, frontDesk);
                }}
              />

              {canViewAudit ? (
                <AuditTimeline
                  title="Auditoria de reserva"
                  description="Check-in, checkout, cancelaciones y excepciones visibles para supervision."
                  entityIds={[bookingState.id, bookingState.room_id]}
                  refreshSignal={`${bookingState.id}:${bookingState.room_id}:${bookingState.status}:${auditRefreshTick}`}
                  emptyMessage="Todavia no hay eventos de auditoria vinculados a esta reserva."
                />
              ) : null}
            </div>
          </section>
        </div>

        <SheetFooter className="border-t bg-card/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => {
                void refreshOperationalData();
              }}
            >
              <CalendarDays className="h-4 w-4" />
              Refrescar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
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
                    Siguiente caso
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              {footerRoom && (
                <Button variant="outline" className="w-full rounded-xl sm:w-auto" disabled>
                  <footerRoom.icon className="h-4 w-4" />
                  {footerRoom.label}
                </Button>
              )}
              <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BookingDetailsSheet;
