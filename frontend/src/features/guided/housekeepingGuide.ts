import type { GuideStepView } from "@/features/guided/types";

export type HousekeepingGuideStepId =
  | "review-board"
  | "start-cleaning"
  | "finish-cleaning"
  | "handle-blocker";

export type HousekeepingGuideEvent =
  | "review_board"
  | "start_cleaning"
  | "finish_cleaning"
  | "handle_blocker";

export type HousekeepingGuideProgress = {
  reviewBoardDone: boolean;
  startCleaningDone: boolean;
  finishCleaningDone: boolean;
  handleBlockerDone: boolean;
};

export type HousekeepingGuideRuntime = {
  pendingTurnover: number;
  inProgress: number;
  ready: number;
  blocked: number;
};

export const defaultHousekeepingGuideProgress = (): HousekeepingGuideProgress => ({
  reviewBoardDone: false,
  startCleaningDone: false,
  finishCleaningDone: false,
  handleBlockerDone: false,
});

export const updateHousekeepingGuideProgress = (
  progress: HousekeepingGuideProgress,
  event: HousekeepingGuideEvent,
): HousekeepingGuideProgress => {
  switch (event) {
    case "review_board":
      return { ...progress, reviewBoardDone: true };
    case "start_cleaning":
      return { ...progress, reviewBoardDone: true, startCleaningDone: true };
    case "finish_cleaning":
      return {
        ...progress,
        reviewBoardDone: true,
        startCleaningDone: true,
        finishCleaningDone: true,
      };
    case "handle_blocker":
      return {
        ...progress,
        reviewBoardDone: true,
        handleBlockerDone: true,
      };
    default:
      return progress;
  }
};

export const buildHousekeepingGuideSteps = (
  progress: HousekeepingGuideProgress,
  runtime: HousekeepingGuideRuntime,
): GuideStepView[] => {
  const startCleaningDone = progress.startCleaningDone || runtime.pendingTurnover === 0;
  const finishCleaningDone =
    progress.finishCleaningDone || (runtime.inProgress === 0 && runtime.ready > 0);
  const handleBlockerDone = progress.handleBlockerDone || runtime.blocked === 0;

  const steps: GuideStepView[] = [
    {
      id: "review-board",
      label: "Revisá prioridades del turno",
      helper:
        "Ubicá primero qué habitaciones siguen sucias, cuáles están en limpieza y dónde hay bloqueos.",
      done: progress.reviewBoardDone,
      active: !progress.reviewBoardDone,
    },
    {
      id: "start-cleaning",
      label: "Tomá una habitación dirty",
      helper:
        "Mové una pieza a Cleaning para empezar a drenar la cola y darle ritmo al turno.",
      done: startCleaningDone,
      active: progress.reviewBoardDone && !startCleaningDone,
    },
    {
      id: "finish-cleaning",
      label: "Liberá inventario",
      helper:
        "Cerrá una limpieza y devolvé la habitación a Available para que vuelva a venderse.",
      done: finishCleaningDone,
      active: progress.reviewBoardDone && startCleaningDone && !finishCleaningDone,
    },
    {
      id: "handle-blocker",
      label: "Escalá un bloqueo si hace falta",
      helper:
        "Si una habitación no puede liberarse, mandala a Maintenance o devolvela a Dirty.",
      done: handleBlockerDone,
      active:
        progress.reviewBoardDone && startCleaningDone && finishCleaningDone && !handleBlockerDone,
    },
  ];

  const activeStep = steps.find((step) => step.active);
  if (!activeStep) {
    const nextPending = steps.find((step) => !step.done);
    if (nextPending) nextPending.active = true;
  }

  return steps;
};

export const housekeepingGuideSummary = (
  steps: GuideStepView[],
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
      title: "Turno de housekeeping bajo control",
      description:
        "Ya recorriste el flujo principal: revisar la cola, iniciar limpieza, liberar inventario y escalar bloqueos.",
    };
  }

  return {
    completed,
    total,
    title: active?.label ?? "Housekeeping guiado",
    description:
      active?.helper ??
      "Seguí el próximo paso recomendado para cerrar habitaciones y devolverlas al inventario.",
  };
};
