import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/api/errors";
import type {
  Booking,
  ExtraCharge,
  Invoice,
  PaymentEntry,
  PaymentMethod,
} from "@/types/domain";
import extraChargeService from "@/features/bookings/services/extraChargeService";
import {
  getBookingPayments,
  getInvoiceByBooking,
  registerBookingPayment,
} from "@/features/bookings/services/invoiceService";

type ToastApi = {
  title: string;
  description: string;
  variant: "success" | "error";
};

type UseBookingBillingControllerProps = {
  bookingState: Booking | null;
  isOpen: boolean;
  toast: (payload: ToastApi) => void;
  onRefreshBooking?: () => Promise<void> | void;
  onBookingTotalDelta: (amountCents: number) => void;
};

export const quickCharges = [
  { label: "Desayuno", category: "RESTAURANTE", amount_cents: 1500 },
  { label: "Minibar", category: "MINIBAR", amount_cents: 800 },
  { label: "Lavanderia", category: "LAVANDERIA", amount_cents: 2500 },
];

export const useBookingBillingController = ({
  bookingState,
  isOpen,
  toast,
  onRefreshBooking,
  onBookingTotalDelta,
}: UseBookingBillingControllerProps) => {
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  useEffect(() => {
    if (!bookingState || !isOpen) {
      setExtraCharges([]);
      setInvoice(null);
      setPayments([]);
      return;
    }

    setLoadingCharges(true);
    Promise.allSettled([
      extraChargeService.getExtraCharges(bookingState.id).then(setExtraCharges),
      getInvoiceByBooking(bookingState.id).then(setInvoice).catch(() => setInvoice(null)),
      getBookingPayments(bookingState.id).then(setPayments).catch(() => setPayments([])),
    ]).finally(() => setLoadingCharges(false));
  }, [bookingState?.id, bookingState?.status, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod("CASH");
      setPaymentReference("");
      setPaymentAmount("");
      setPaymentNote("");
      return;
    }

    setPaymentMethod(invoice?.payment_method ?? "CASH");
    setPaymentReference(invoice?.payment_reference ?? "");
    setPaymentAmount(
      invoice
        ? String(Math.max(0, Math.trunc((invoice.amount_cents - invoice.paid_amount_cents) / 100)))
        : "",
    );
    setPaymentNote("");
  }, [
    invoice?.amount_cents,
    invoice?.paid_amount_cents,
    invoice?.payment_method,
    invoice?.payment_reference,
    isOpen,
  ]);

  const extrasTotal = useMemo(
    () => extraCharges.reduce((sum, charge) => sum + charge.amount_cents, 0),
    [extraCharges],
  );
  const accommodationTotal = useMemo(
    () => Math.max(0, (bookingState?.total_price_cents ?? 0) - extrasTotal),
    [bookingState?.total_price_cents, extrasTotal],
  );
  const outstandingAmountCents = useMemo(
    () =>
      invoice
        ? Math.max(0, invoice.amount_cents - invoice.paid_amount_cents)
        : bookingState?.total_price_cents ?? 0,
    [bookingState?.total_price_cents, invoice],
  );

  const refreshBillingData = async (targetBooking?: Booking) => {
    const currentBooking = targetBooking ?? bookingState;
    if (!currentBooking) return;
    setLoadingCharges(true);
    try {
      const [chargesData, invoiceData] = await Promise.all([
        extraChargeService.getExtraCharges(currentBooking.id),
        getInvoiceByBooking(currentBooking.id).catch(() => null),
      ]);
      const paymentsData = await getBookingPayments(currentBooking.id).catch(() => []);
      setExtraCharges(chargesData);
      setInvoice(invoiceData);
      setPayments(paymentsData);
      await onRefreshBooking?.();
    } finally {
      setLoadingCharges(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!bookingState) return;

    if (paymentReference.trim().length > 0 && paymentReference.trim().length < 3) {
      toast({
        title: "Referencia invalida",
        description: "Si cargas una referencia de pago, usa al menos 3 caracteres.",
        variant: "error",
      });
      return;
    }
    if (paymentNote.trim().length > 0 && paymentNote.trim().length < 3) {
      toast({
        title: "Nota invalida",
        description: "Si cargas una nota operativa, usa al menos 3 caracteres.",
        variant: "error",
      });
      return;
    }

    const normalizedAmount = Number(paymentAmount.replace(",", "."));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast({
        title: "Monto invalido",
        description: "Ingresa un monto valido para registrar el cobro.",
        variant: "error",
      });
      return;
    }

    setSettlementLoading(true);
    try {
      const settledInvoice = await registerBookingPayment(
        bookingState.id,
        Math.round(normalizedAmount * 100),
        paymentMethod,
        paymentReference.trim() || undefined,
        paymentNote.trim() || undefined,
      );
      setInvoice(settledInvoice);
      toast({
        title: "Pago registrado",
        description:
          settledInvoice.paid_amount_cents >= settledInvoice.amount_cents
            ? "La reserva quedo completamente cobrada y el movimiento ya impacta en caja."
            : "El cobro parcial quedo registrado y el saldo pendiente fue actualizado.",
        variant: "success",
      });
      await refreshBillingData();
    } catch (error: unknown) {
      toast({
        title: "No se pudo registrar el pago",
        description: getErrorMessage(error, "Revisa el medio de pago e intenta nuevamente."),
        variant: "error",
      });
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleQuickCharge = async (label: string, amount_cents: number, category: string) => {
    if (!bookingState) return;

    try {
      setLoadingCharges(true);
      await extraChargeService.addExtraCharge(bookingState.id, {
        description: label,
        amount_cents,
        category,
      });
      onBookingTotalDelta(amount_cents);
      toast({
        title: "Cargo agregado",
        description: `${label} fue sumado a la cuenta del huesped.`,
        variant: "success",
      });
      await refreshBillingData();
    } catch (error: unknown) {
      toast({
        title: "No se pudo agregar el cargo",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
      setLoadingCharges(false);
    }
  };

  return {
    extraCharges,
    invoice,
    payments,
    loadingCharges,
    settlementLoading,
    paymentMethod,
    paymentAmount,
    paymentReference,
    paymentNote,
    extrasTotal,
    accommodationTotal,
    outstandingAmountCents,
    quickCharges,
    setPaymentMethod,
    setPaymentAmount,
    setPaymentReference,
    setPaymentNote,
    refreshBillingData,
    handleRegisterPayment,
    handleQuickCharge,
  };
};
