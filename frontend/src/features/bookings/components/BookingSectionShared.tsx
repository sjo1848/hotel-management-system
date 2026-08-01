import { AlertTriangle, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionEyebrow } from "@/components/ui/section-card";

export type NextAction = {
  title: string;
  description: string;
  action: "check-in" | "check-out" | null;
  disabled: boolean;
  buttonLabel: string | null;
};

export type BookingCheckInFormState = {
  documentVerified: boolean;
  stayConfirmed: boolean;
  contactConfirmed: boolean;
  guestsCount: string;
  arrivalReference: string;
};

export type BookingCheckOutFormState = {
  chargesReviewed: boolean;
  roomReleaseConfirmed: boolean;
  housekeepingHandoff: boolean;
  paymentPolicy: "" | "settled" | "pending-approved";
  closingReference: string;
};

export const BlockerList = ({ blockers }: { blockers: string[] }) => (
  <div className="mt-3 space-y-2">
    {blockers.map((blocker) => (
      <div
        key={blocker}
        className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{blocker}</span>
      </div>
    ))}
  </div>
);

export const PanelHeader = ({
  icon: Icon,
  title,
  description,
  tone = "primary",
}: {
  icon: typeof User | typeof Loader2;
  title: string;
  description: string;
  tone?: "primary" | "muted";
}) => (
  <div className="mb-4 flex items-center gap-3">
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-2xl",
        tone === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <SectionEyebrow className="text-foreground">{title}</SectionEyebrow>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);
