import { useEffect, useMemo, useRef, useState } from "react";
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
  enabled?: boolean;
  toast: (payload: ToastApi) => void;
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
  enabled = true,
  toast,
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
  const [billingBookingId, setBillingBookingId] = useState<string | null>(null);
  const billingRequestIdRef = useRef(0);

  const billingMatchesBooking = billingBookingId === (bookingState?.id ?? null);
  const currentExtraCharges = billingMatchesBooking ? extraCharges : [];
  const currentInvoice = billingMatchesBooking ? invoice : null;
  const currentPayments = billingMatchesBooking ? payments : [];

  useEffect(() => {
    const requestId = ++billingRequestIdRef.current;
    if (!bookingState || !isOpen) {
      setBillingBookingId(null);
      setExtraCharges([]);
      setInvoice(null);
      setPayments([]);
      return;
    }
    if (!enabled) return;

    setBillingBookingId(bookingState.id);
    setExtraCharges([]);
    setInvoice(null);
    setPayments([]);
    setLoadingCharges(true);
    Promise.allSettled([
      extraChargeService.getExtraCharges(bookingState.id).then((data) => {
        if (billingRequestIdRef.current === requestId) setExtraCharges(data);
      }),
      getInvoiceByBooking(bookingState.id).then((data) => {
        if (billingRequestIdRef.current === requestId) setInvoice(data);
      }).catch(() => undefined),
      getBookingPayments(bookingState.id).then((data) => {
        if (billingRequestIdRef.current === requestId) setPayments(data);
      }).catch(() => undefined),
    ]).finally(() => {
      if (billingRequestIdRef.current === requestId) setLoadingCharges(false);
    });
  }, [bookingState?.id, enabled, isOpen]);

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
    () => currentExtraCharges.reduce((sum, charge) => sum + charge.amount_cents, 0),
    [currentExtraCharges],
  );
  const accommodationTotal = useMemo(
    () => Math.max(0, (bookingState?.total_price_cents ?? 0) - extrasTotal),
    [bookingState?.total_price_cents, extrasTotal],
  );
  const outstandingAmountCents = useMemo(
    () =>
      currentInvoice
        ? Math.max(0, currentInvoice.amount_cents - currentInvoice.paid_amount_cents)
        : bookingState?.total_price_cents ?? 0,
    [bookingState?.total_price_cents, currentInvoice],
  );

  const refreshBillingData = async (targetBooking?: Booking) => {
    const currentBooking = targetBooking ?? bookingState;
    if (!currentBooking) return;
    const requestId = ++billingRequestIdRef.current;
    const sameBookingState = billingBookingId === currentBooking.id && bookingState?.id === currentBooking.id;
    const fallbackCharges = sameBookingState ? currentExtraCharges : [];
    const fallbackInvoice = sameBookingState ? currentInvoice : null;
    const fallbackPayments = sameBookingState ? currentPayments : [];
    setBillingBookingId(currentBooking.id);
    setLoadingCharges(true);
    try {
      const [chargesResult, invoiceResult, paymentsResult] = await Promise.allSettled([
        extraChargeService.getExtraCharges(currentBooking.id),
        getInvoiceByBooking(currentBooking.id),
        getBookingPayments(currentBooking.id),
      ]);
      if (billingRequestIdRef.current !== requestId || bookingState?.id !== currentBooking.id) return;
      const chargesData = chargesResult.status === "fulfilled" ? chargesResult.value : fallbackCharges;
      const invoiceData = invoiceResult.status === "fulfilled" ? invoiceResult.value : fallbackInvoice;
      const paymentsData = paymentsResult.status === "fulfilled" ? paymentsResult.value : fallbackPayments;
      setExtraCharges(chargesData);
      setInvoice(invoiceData);
      setPayments(paymentsData);
    } finally {
      if (billingRequestIdRef.current === requestId) setLoadingCharges(false);
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

    const paymentBookingId = bookingState.id;
    const requestId = ++billingRequestIdRef.current;
    setSettlementLoading(true);
    try {
      const settledInvoice = await registerBookingPayment(
        bookingState.id,
        Math.round(normalizedAmount * 100),
        paymentMethod,
        paymentReference.trim() || undefined,
        paymentNote.trim() || undefined,
      );
      if (billingRequestIdRef.current !== requestId || bookingState?.id !== paymentBookingId) return;
      setBillingBookingId(paymentBookingId);
      setInvoice(settledInvoice);
      toast({
        title: "Pago registrado",
        description:
          settledInvoice.paid_amount_cents >= settledInvoice.amount_cents
            ? "La reserva quedo completamente cobrada y el movimiento ya impacta en caja."
            : "El cobro parcial quedo registrado y el saldo pendiente fue actualizado.",
        variant: "success",
      });
      const paymentsData = await getBookingPayments(paymentBookingId).catch(() => currentPayments);
      if (billingRequestIdRef.current !== requestId || bookingState?.id !== paymentBookingId) return;
      setPayments(paymentsData);
    } catch (error: unknown) {
      toast({
        title: "No se pudo registrar el pago",
        description: getErrorMessage(error, "Revisa el medio de pago e intenta nuevamente."),
        variant: "error",
      });
    } finally {
      if (billingRequestIdRef.current === requestId) setSettlementLoading(false);
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
    extraCharges: currentExtraCharges,
    invoice: currentInvoice,
    payments: currentPayments,
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
