import type { BookingStatus } from "@/types/domain";
import type { GuideStepView } from "@/features/guided/types";

export type ReceptionGuideStepId =
  | "open-case"
  | "review-case"
  | "check-in"
  | "payment"
  | "checkout";

export type ReceptionGuideEvent =
  | "open_case"
  | "open_walk_in"
  | "review_case"
  | "checkin_complete"
  | "payment_registered"
  | "checkout_complete";

export type ReceptionGuideProgress = {
  openCaseDone: boolean;
  reviewCaseDone: boolean;
  checkInDone: boolean;
  paymentDone: boolean;
  checkoutDone: boolean;
};

export type ReceptionGuideStep = GuideStepView & {
  id: ReceptionGuideStepId;
};

export const defaultReceptionGuideProgress = (): ReceptionGuideProgress => ({
  openCaseDone: false,
  reviewCaseDone: false,
  checkInDone: false,
  paymentDone: false,
  checkoutDone: false,
});

export const updateReceptionGuideProgress = (
  progress: ReceptionGuideProgress,
  event: ReceptionGuideEvent,
): ReceptionGuideProgress => {
  switch (event) {
    case "open_case":
      return { ...progress, openCaseDone: true };
    case "open_walk_in":
      return { ...progress, openCaseDone: true, reviewCaseDone: true };
    case "review_case":
      return { ...progress, openCaseDone: true, reviewCaseDone: true };
    case "checkin_complete":
      return { ...progress, openCaseDone: true, reviewCaseDone: true, checkInDone: true };
    case "payment_registered":
      return {
        ...progress,
        openCaseDone: true,
        reviewCaseDone: true,
        paymentDone: true,
      };
    case "checkout_complete":
      return {
        openCaseDone: true,
        reviewCaseDone: true,
        checkInDone: true,
        paymentDone: true,
        checkoutDone: true,
      };
    default:
      return progress;
  }
};

export const buildReceptionGuideSteps = (
  progress: ReceptionGuideProgress,
  bookingStatus?: BookingStatus,
): ReceptionGuideStep[] => {
  const steps: ReceptionGuideStep[] = [
    {
      id: "open-case",
      label: "Abrí un caso del turno",
      helper: "Tomá una llegada lista, un bloqueo o iniciá un walk-in para empezar a operar.",
      done: progress.openCaseDone,
      active: !progress.openCaseDone,
    },
    {
      id: "review-case",
      label: "Validá huésped y estadía",
      helper: "Revisá la ficha, la habitación y el siguiente paso recomendado desde el centro operativo.",
      done: progress.reviewCaseDone,
      active: progress.openCaseDone && !progress.reviewCaseDone,
    },
    {
      id: "check-in",
      label: "Registrá la llegada",
      helper: "Completá el check-in formal cuando la reserva esté confirmada y la habitación lista.",
      done: progress.checkInDone,
      active:
        progress.reviewCaseDone &&
        !progress.checkInDone &&
        (bookingStatus === "Confirmed" || bookingStatus === undefined),
    },
    {
      id: "payment",
      label: "Cerrá cuenta o registrá cobro",
      helper: "Antes del checkout, dejá la cuenta clara y cobrá cuando corresponda.",
      done: progress.paymentDone,
      active:
        progress.reviewCaseDone &&
        !progress.paymentDone &&
        (bookingStatus === "CheckedIn" || bookingStatus === undefined),
    },
    {
      id: "checkout",
      label: "Finalizá la salida",
      helper: "Cerrá checkout y dejá la habitación lista para pasar a housekeeping.",
      done: progress.checkoutDone,
      active:
        (progress.paymentDone || bookingStatus === "CheckedOut") &&
        !progress.checkoutDone,
    },
  ];

  const activeStep = steps.find((step) => step.active);
  if (!activeStep) {
    const nextPending = steps.find((step) => !step.done);
    if (nextPending) {
      nextPending.active = true;
    }
  }

  return steps;
};

export const receptionGuideSummary = (
  steps: ReceptionGuideStep[],
): {
  completed: number;
  total: number;
  title: string;
  description: string;
} => {
  const completed = steps.filter((step) => step.done).length;
  const total = steps.length;
  const active = steps.find((step) => step.active);

  if (completed === total) {
    return {
      completed,
      total,
      title: "Turno guiado completo",
      description: "Ya recorriste el flujo principal. Podés seguir operando sin asistencia o reiniciar la guía.",
    };
  }

  return {
    completed,
    total,
    title: active?.label ?? "Recepción guiada",
    description: active?.helper ?? "Seguí el próximo paso recomendado para completar el flujo del turno.",
  };
};
