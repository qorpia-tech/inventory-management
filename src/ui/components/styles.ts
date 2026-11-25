// Pure class helpers, usable from server and client components.

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export type Variant = "primary" | "secondary" | "dark" | "ghost" | "danger" | "outlineLight";
export type Size = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  primary: "bg-gold-500 text-petroleum-950 [@media(hover:hover)]:hover:bg-gold-300",
  secondary: "bg-white text-petroleum-700 border border-petroleum-700/40 [@media(hover:hover)]:hover:bg-ivory-100",
  dark: "bg-petroleum-700 text-ivory-50 [@media(hover:hover)]:hover:bg-petroleum-800",
  ghost: "bg-transparent text-petroleum-700 [@media(hover:hover)]:hover:bg-ivory-200",
  outlineLight: "bg-transparent text-ivory-50 border border-ivory-50/40 [@media(hover:hover)]:hover:bg-petroleum-950/40",
  danger: "bg-blush-700 text-ivory-50 [@media(hover:hover)]:hover:bg-blush-800",
};

const SIZE: Record<Size, string> = {
  md: "min-h-12 px-4 py-2 button-md rounded-xl",
  sm: "min-h-11 px-3 py-2 button-sm rounded-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cx(
    "pressable inline-flex items-center justify-center gap-2 text-center select-none",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

