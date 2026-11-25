"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { cx } from "./primitives";

const control =
  "w-full min-h-12 rounded-xl border border-line-strong bg-white px-3 py-2 text-base text-ink-900 placeholder:text-ink-600 aria-[invalid=true]:border-blush-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-blush-700";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="body-5 text-ink-900">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="caption-4 text-ink-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="caption-4 text-blush-800" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = ComponentProps<"input"> & { invalid?: boolean };

export function TextInput({ invalid, className, id, ...props }: InputProps) {
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : props["aria-describedby"]}
      className={cx(control, className)}
      {...props}
    />
  );
}

export function SelectInput({ invalid, className, id, children, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select id={id} aria-invalid={invalid || undefined} className={cx(control, "appearance-auto", className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ invalid, className, id, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea id={id} aria-invalid={invalid || undefined} className={cx(control, "min-h-28 leading-6", className)} {...props} />;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Quantity input with − / + buttons of 44 px, numeric keyboard and 16 px text.
 * Typing is free; the value is clamped and reported when the field loses focus.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99999,
  disabled,
  id: givenId,
  hideLabel,
  tone,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  id?: string;
  hideLabel?: boolean;
  tone?: "default" | "error";
}) {
  const generated = useId();
  const id = givenId ?? generated;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/\D/g, ""), 10);
    onChange(clamp(Number.isNaN(parsed) ? min : parsed, min, max));
    setDraft(null);
  };
  const button =
    "pressable inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-ivory-200 text-petroleum-700 disabled:opacity-40 [@media(hover:hover)]:hover:bg-ivory-300";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={cx("body-5 text-ink-900", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className={cx("grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1 rounded-xl border bg-white p-0.5", tone === "error" ? "border-blush-700" : "border-line-strong")}>
        <button type="button" className={button} onClick={() => onChange(clamp(value - 1, min, max))} disabled={disabled || value <= min} aria-label={`Restar uno a ${label}`}>
          <MinusIcon size={18} weight="bold" aria-hidden />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          className="min-h-11 w-full min-w-0 bg-transparent text-center text-base font-semibold tabular-nums text-ink-900 outline-none"
          value={draft ?? String(value)}
          disabled={disabled}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
        />
        <button type="button" className={button} onClick={() => onChange(clamp(value + 1, min, max))} disabled={disabled || value >= max} aria-label={`Sumar uno a ${label}`}>
          <PlusIcon size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Segmented choice with 48 px targets. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className={cx("body-5 pb-1 text-ink-900", hideLabel && "sr-only")}>{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-ivory-200 p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cx(
                "pressable min-h-11 rounded-lg px-2 button-sm",
                active ? "bg-white text-petroleum-950 shadow-sm" : "text-ink-700 [@media(hover:hover)]:hover:bg-ivory-100",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
