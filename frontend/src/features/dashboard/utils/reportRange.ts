import { format } from "date-fns";

export type ReportRange = "7d" | "30d";

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  "7d": "7 días",
  "30d": "30 días",
};

export const DEFAULT_REPORT_RANGE: ReportRange = "30d";

export const REPORT_RANGE_DAYS: Record<ReportRange, number> = {
  "7d": 7,
  "30d": 30,
};

export type ReportRangeDates = {
  start: string;
  end: string;
};

export const getReportRange = (
  range: ReportRange,
  now: Date = new Date(),
): ReportRangeDates => {
  const days = REPORT_RANGE_DAYS[range];
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(now, "yyyy-MM-dd"),
  };
};
