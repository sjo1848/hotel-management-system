import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideStepView } from "@/features/guided/types";

type CompactGuideAssistantProps = {
  title: string;
  description: string;
  completed: number;
  total: number;
  steps: GuideStepView[];
  ctaLabel?: string;
  onCta?: () => void;
  onReset: () => void;
  onStepSelect?: (stepId: string) => void;
};

const progressPercent = (completed: number, total: number) =>
  total === 0 ? 0 : Math.round((completed / total) * 100);

const CompactGuideAssistant = ({
  title,
  description,
  completed,
  total,
  steps,
  ctaLabel,
  onCta,
  onReset,
  onStepSelect,
}: CompactGuideAssistantProps) => {
  const [expanded, setExpanded] = useState(false);
  const activeStep = steps.find((step) => step.active);
  const hasCta = Boolean(ctaLabel && onCta);

  return (
    <section className="motion-refresh" aria-label="Asistente guiado">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 shadow-sm">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="compact-guide-panel"
          className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setExpanded(!expanded)}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-bold text-foreground">
            Siguiente: {activeStep?.label ?? title}
          </span>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-black text-primary">
            {completed}/{total}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        {hasCta ? (
          <Button type="button" size="sm" className="h-9 shrink-0 rounded-xl" onClick={onCta}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div
          id="compact-guide-panel"
          className="mt-2 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
                <Compass className="h-3.5 w-3.5" />
                Misión guiada
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 max-w-[64ch] text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" className="h-9 rounded-xl" onClick={onReset}>
                <RotateCcw className="h-4 w-4" />
                Reiniciar
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => setExpanded(false)}>
                Contraer
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent(completed, total)}%` }}
              />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {completed}/{total} completado
            </p>
          </div>

          <div className="grid gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-current={step.active ? "step" : undefined}
                onClick={() => onStepSelect?.(step.id)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-all",
                  step.done && "border-primary/20 bg-primary/10",
                  !step.done && step.active && "border-primary/30 bg-card ring-2 ring-primary/20",
                  !step.done && !step.active && "border-border bg-card/80",
                  onStepSelect &&
                    "cursor-pointer hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                )}
              >
                <div
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                    step.done
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : step.active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground">{step.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.helper}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    {step.done ? "Completado" : step.active ? "Ahora" : "Pendiente"}
                  </span>
                  {onStepSelect ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                      {step.actionLabel ?? "Ver paso"}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default CompactGuideAssistant;
