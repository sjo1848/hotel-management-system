import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div";
};

export const SectionCard = ({
  as = "section",
  className,
  ...props
}: SectionCardProps) => {
  const Component = as;
  return (
    <Component
      className={cn(
        "motion-surface motion-lift rounded-3xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
      {...props}
    />
  );
};

type SectionEyebrowProps = {
  children: ReactNode;
  className?: string;
};

export const SectionEyebrow = ({ children, className }: SectionEyebrowProps) => (
  <p
    className={cn(
      "text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground",
      className,
    )}
  >
    {children}
  </p>
);
