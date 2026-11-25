"use client";

export { buttonClass, cx } from "./styles";

import Link from "./app-link";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass, cx, type Size, type Variant } from "./styles";
import { CaretLeftIcon, CheckCircleIcon, InfoIcon, WarningIcon, XIcon } from "@phosphor-icons/react";

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export type Tone = "sage" | "apricot" | "blush" | "mist" | "sand" | "neutral" | "gold" | "dark";

const TONE: Record<Tone, string> = {
  sage: "bg-sage-100 text-sage-800",
  apricot: "bg-apricot-100 text-apricot-800",
  blush: "bg-blush-100 text-blush-800",
  mist: "bg-mist-100 text-mist-800",
  sand: "bg-sand-100 text-sand-800",
  neutral: "bg-ivory-200 text-ink-700",
  gold: "bg-gold-100 text-gold-800",
  dark: "bg-petroleum-700 text-ivory-50",
};

/** Status is never conveyed by color alone: every badge carries text. */
export function Badge({ tone, icon, children, className }: { tone: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex min-h-6 items-center gap-1 rounded-full px-2 py-0.5 caption-4", TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function toneClass(tone: Tone): string {
  return TONE[tone];
}

/** A key number readable at a glance. */
export function Stat({
  label,
  value,
  tone,
  emphasis = false,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-0.5 rounded-xl px-2 py-2 min-[400px]:px-3", tone ? TONE[tone] : "bg-ivory-100 text-ink-900", className)}>
      <span className="caption-4 opacity-90">{label}</span>
      <span className={cx(emphasis ? "number-lg" : "number-md")}>{value}</span>
    </div>
  );
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "article" | "div" | "li" }) {
  return <As className={cx("rounded-2xl border border-ivory-300 bg-white p-4", className)}>{children}</As>;
}

export function PageHeader({
  title,
  description,
  back,
  aside,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 pb-4">
      {back && (
        <Link href={back.href} className="pressable -ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 body-5 text-petroleum-700">
          <CaretLeftIcon size={18} aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="heading-5 md:heading-4 text-ink-900">{title}</h1>
          {description && <div className="body-6 text-ink-600">{description}</div>}
        </div>
        {aside}
      </div>
    </header>
  );
}

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-2 pt-6">
      <h2 id={id} className="title-2 text-ink-900">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
  onDismiss,
  role,
}: {
  tone?: "success" | "error" | "warning" | "neutral";
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  role?: "status" | "alert";
}) {
  const styles = {
    success: { box: "bg-sage-100 text-sage-800", icon: <CheckCircleIcon size={20} weight="fill" aria-hidden /> },
    error: { box: "bg-blush-100 text-blush-800", icon: <WarningIcon size={20} weight="fill" aria-hidden /> },
    warning: { box: "bg-apricot-100 text-apricot-800", icon: <WarningIcon size={20} weight="fill" aria-hidden /> },
    neutral: { box: "bg-ivory-200 text-ink-700", icon: <InfoIcon size={20} weight="fill" aria-hidden /> },
  }[tone];
  return (
    <div role={role ?? (tone === "error" ? "alert" : "status")} className={cx("flex items-start gap-3 rounded-xl p-3", styles.box)}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="body-4 font-semibold">{title}</p>}
        {children && <div className="body-6">{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="pressable -m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg" aria-label="Cerrar aviso">
          <XIcon size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Skeleton shaped like the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-ivory-200 motion-reduce:animate-none", className)} />;
}

export function LoadingCards({ count = 3, label = "Cargando" }: { count?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ivory-300 bg-ivory-100 px-4 py-8 text-center">
      {icon && <span className="text-petroleum-700">{icon}</span>}
      <p className="title-3 text-ink-900">{title}</p>
      {children && <div className="body-6 max-w-sm text-ink-600">{children}</div>}
      {action}
    </div>
  );
}
