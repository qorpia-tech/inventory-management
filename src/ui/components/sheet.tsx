"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@phosphor-icons/react";

/**
 * Bottom sheet on phones, centered dialog from tablet up. CSS transitions keep it
 * interruptible; Escape and the backdrop close it; focus moves in and returns on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      const frame = requestAnimationFrame(() => {
        setVisible(true);
        panelRef.current?.focus();
      });
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        cancelAnimationFrame(frame);
        document.body.style.overflow = previous;
        window.removeEventListener("keydown", onKey);
      };
    }
    const frame = requestAnimationFrame(() => setVisible(false));
    const timer = window.setTimeout(() => {
      setMounted(false);
      returnFocus.current?.focus?.();
    }, 240);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open, mounted, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="sheet-backdrop absolute inset-0 bg-petroleum-950/60" data-open={visible} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        data-open={visible}
        className="sheet-panel relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-ivory-50 shadow-2xl outline-none md:max-w-lg md:rounded-3xl"
      >
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-ivory-300" />
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3 md:px-6 md:pt-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="sheet-title" className="heading-6 text-ink-900">
              {title}
            </h2>
            {description && <div className="body-6 text-ink-600">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="pressable -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-700" aria-label="Cerrar">
            <XIcon size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6">{children}</div>
        {footer && <div className="border-t border-ivory-300 px-4 pb-[calc(16px+var(--safe-bottom))] pt-3 md:px-6 md:pb-6">{footer}</div>}
        {!footer && <div className="pb-[var(--safe-bottom)]" aria-hidden />}
      </div>
    </div>,
    document.body,
  );
}
