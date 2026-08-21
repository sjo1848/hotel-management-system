import { useEffect, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type MobilePickerSurfaceProps = {
  open: boolean;
  title: string;
  description: string;
  titleId: string;
  initialFocusRef: RefObject<HTMLElement>;
  desktopFocusRef?: RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
};

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const MobilePickerSurface = ({
  open,
  title,
  description,
  titleId,
  initialFocusRef,
  desktopFocusRef,
  onClose,
  children,
}: MobilePickerSurfaceProps) => {
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => initialFocusRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) return;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      onClose();
      window.requestAnimationFrame(() => desktopFocusRef?.current?.focus());
    };
    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, [desktopFocusRef, onClose, open]);

  if (!open) return null;
  const portalRoot = document.getElementById("walk-in-mobile-picker-root");
  if (!portalRoot) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      role="region"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] flex h-dvh flex-col bg-card p-4 md:hidden"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 id={titleId} className="text-base font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="ghost" aria-label={`Cerrar ${title.toLowerCase()}`} className="h-11 w-11 shrink-0 rounded-xl p-0" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      {children}
    </div>,
    portalRoot,
  );
};
