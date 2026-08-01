import { CheckCircle2, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideStepView } from "@/features/guided/types";

type GuideRailProps = {
  title: string;
  description: string;
  completed: number;
  total: number;
  steps: GuideStepView[];
  enabled: boolean;
  onToggle: () => void;
  onReset: () => void;
  ctaLabel?: string;
  onCta?: () => void;
};

const progressPercent = (completed: number, total: number) =>
  total === 0 ? 0 : Math.round((completed / total) * 100);

const GuideRail = ({
  title,
  description,
  completed,
  total,
  steps,
  enabled,
  onToggle,
  onReset,
  ctaLabel,
  onCta,
}: GuideRailProps) => {
  return (
    <section className="motion-refresh overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Modo guiado
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
            <p className="mt-2 max-w-[64ch] text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          {ctaLabel && onCta ? (
            <Button className="h-10 rounded-2xl" onClick={onCta}>
              <Compass className="h-4 w-4" />
              {ctaLabel}
            </Button>
          ) : null}
          <Button variant="outline" className="h-10 rounded-2xl" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reiniciar
          </Button>
          <Button variant={enabled ? "secondary" : "outline"} className="h-10 rounded-2xl" onClick={onToggle}>
            {enabled ? "Ocultar guía" : "Activar guía"}
          </Button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
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

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => (
          <article
            key={step.id}
            className={cn(
              "rounded-2xl border px-4 py-4 shadow-sm transition-all",
              step.done && "border-primary/20 bg-primary/10",
              !step.done && step.active && "border-primary/30 bg-card ring-1 ring-primary/20",
              !step.done && !step.active && "border-border bg-card/80",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                  step.done
                    ? "border-primary/30 bg-primary text-primary-foreground"
                    : step.active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <div>
                <p className="text-sm font-black text-foreground">{step.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.helper}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default GuideRail;
