import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export const PageHeader = ({
  title,
  description,
  icon,
  actions,
  className,
}: PageHeaderProps) => (
  <div
    className={cn(
      "motion-refresh flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
      className,
    )}
  >
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="motion-live-pill motion-surface flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black leading-none tracking-tight text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>

    {actions ? (
      <div className="motion-refresh flex flex-wrap items-stretch gap-2 sm:items-center sm:gap-3">
        {actions}
      </div>
    ) : null}
  </div>
);
