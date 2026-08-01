import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildReceptionGuideSteps,
  defaultReceptionGuideProgress,
  receptionGuideSummary,
  type ReceptionGuideEvent,
  type ReceptionGuideProgress,
  updateReceptionGuideProgress,
} from "@/features/guided/receptionGuide";
import {
  buildHousekeepingGuideSteps,
  defaultHousekeepingGuideProgress,
  housekeepingGuideSummary,
  type HousekeepingGuideEvent,
  type HousekeepingGuideProgress,
  type HousekeepingGuideRuntime,
  updateHousekeepingGuideProgress,
} from "@/features/guided/housekeepingGuide";
import type { BookingStatus } from "@/types/domain";

type GuidedModeContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  resetReceptionGuide: () => void;
  trackReceptionEvent: (event: ReceptionGuideEvent) => void;
  receptionProgress: ReceptionGuideProgress;
  resetHousekeepingGuide: () => void;
  trackHousekeepingEvent: (event: HousekeepingGuideEvent) => void;
  housekeepingProgress: HousekeepingGuideProgress;
  getReceptionGuideState: (bookingStatus?: BookingStatus) => {
    steps: ReturnType<typeof buildReceptionGuideSteps>;
    summary: ReturnType<typeof receptionGuideSummary>;
  };
  getHousekeepingGuideState: (runtime: HousekeepingGuideRuntime) => {
    steps: ReturnType<typeof buildHousekeepingGuideSteps>;
    summary: ReturnType<typeof housekeepingGuideSummary>;
  };
};

const GUIDED_MODE_KEY = "hms-guided-mode-enabled";
const RECEPTION_GUIDE_KEY = "hms-guided-reception-progress";
const HOUSEKEEPING_GUIDE_KEY = "hms-guided-housekeeping-progress";

const GuidedModeContext = createContext<GuidedModeContextValue | null>(null);

const readBoolean = (key: string, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) === "false" ? false : fallback;
};

const readReceptionProgress = (): ReceptionGuideProgress => {
  if (typeof window === "undefined") return defaultReceptionGuideProgress();
  const raw = window.localStorage.getItem(RECEPTION_GUIDE_KEY);
  if (!raw) return defaultReceptionGuideProgress();
  try {
    return { ...defaultReceptionGuideProgress(), ...JSON.parse(raw) } as ReceptionGuideProgress;
  } catch {
    return defaultReceptionGuideProgress();
  }
};

const readHousekeepingProgress = (): HousekeepingGuideProgress => {
  if (typeof window === "undefined") return defaultHousekeepingGuideProgress();
  const raw = window.localStorage.getItem(HOUSEKEEPING_GUIDE_KEY);
  if (!raw) return defaultHousekeepingGuideProgress();
  try {
    return {
      ...defaultHousekeepingGuideProgress(),
      ...JSON.parse(raw),
    } as HousekeepingGuideProgress;
  } catch {
    return defaultHousekeepingGuideProgress();
  }
};

export const GuidedModeProvider = ({ children }: { children: ReactNode }) => {
  const [enabled, setEnabled] = useState<boolean>(() => readBoolean(GUIDED_MODE_KEY, true));
  const [receptionProgress, setReceptionProgress] = useState<ReceptionGuideProgress>(() =>
    readReceptionProgress(),
  );
  const [housekeepingProgress, setHousekeepingProgress] = useState<HousekeepingGuideProgress>(() =>
    readHousekeepingProgress(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GUIDED_MODE_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RECEPTION_GUIDE_KEY, JSON.stringify(receptionProgress));
  }, [receptionProgress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOUSEKEEPING_GUIDE_KEY, JSON.stringify(housekeepingProgress));
  }, [housekeepingProgress]);

  const value = useMemo<GuidedModeContextValue>(
    () => ({
      enabled,
      setEnabled,
      resetReceptionGuide: () => setReceptionProgress(defaultReceptionGuideProgress()),
      trackReceptionEvent: (event) =>
        setReceptionProgress((current) => updateReceptionGuideProgress(current, event)),
      receptionProgress,
      resetHousekeepingGuide: () => setHousekeepingProgress(defaultHousekeepingGuideProgress()),
      trackHousekeepingEvent: (event) =>
        setHousekeepingProgress((current) => updateHousekeepingGuideProgress(current, event)),
      housekeepingProgress,
      getReceptionGuideState: (bookingStatus?: BookingStatus) => {
        const steps = buildReceptionGuideSteps(receptionProgress, bookingStatus);
        return {
          steps,
          summary: receptionGuideSummary(steps),
        };
      },
      getHousekeepingGuideState: (runtime: HousekeepingGuideRuntime) => {
        const steps = buildHousekeepingGuideSteps(housekeepingProgress, runtime);
        return {
          steps,
          summary: housekeepingGuideSummary(steps),
        };
      },
    }),
    [enabled, housekeepingProgress, receptionProgress],
  );

  return <GuidedModeContext.Provider value={value}>{children}</GuidedModeContext.Provider>;
};

export const useGuidedMode = () => {
  const context = useContext(GuidedModeContext);
  if (!context) {
    throw new Error("useGuidedMode must be used inside GuidedModeProvider");
  }
  return context;
};
