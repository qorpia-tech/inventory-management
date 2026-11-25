import { LIMA_TIME_ZONE } from "@/lib/lima-time";

const locale = "es-PE";

const longDate = new Intl.DateTimeFormat(locale, { timeZone: LIMA_TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const longDateYear = new Intl.DateTimeFormat(locale, { timeZone: LIMA_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat(locale, { timeZone: LIMA_TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat(locale, { timeZone: LIMA_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Sábado, 28 de noviembre» */
export function formatLongDate(epoch: number): string {
  return capitalize(longDate.format(epoch));
}

/** «sábado, 28 de noviembre de 2026» (lower case, for sentences) */
export function formatLongDateYear(epoch: number): string {
  return longDateYear.format(epoch);
}

/** «sáb, 28 nov» */
export function formatShortDate(epoch: number): string {
  return shortDate.format(epoch).replace(/\./g, "");
}

/** «14:00» */
export function formatTime(epoch: number): string {
  return time.format(epoch);
}

/** «sáb, 28 nov · 14:00» */
export function formatDateTime(epoch: number): string {
  return `${formatShortDate(epoch)} · ${formatTime(epoch)}`;
}

export function formatQty(value: number): string {
  return integer.format(value);
}

export function plural(count: number, one: string, many: string): string {
  return `${formatQty(count)} ${count === 1 ? one : many}`;
}
