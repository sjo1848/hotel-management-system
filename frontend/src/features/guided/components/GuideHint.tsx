import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type GuideHintProps = {
  eyebrow?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
};

const GuideHint = ({
  eyebrow = "Siguiente paso recomendado",
  title,
  description,
  ctaLabel,
  onCta,
}: GuideHintProps) => {
  return (
    <div className="motion-live-pill rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">{eyebrow}</p>
          <p className="mt-2 text-sm font-black text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {ctaLabel && onCta ? (
            <Button className="mt-3 h-9 rounded-xl" size="sm" onClick={onCta}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GuideHint;
