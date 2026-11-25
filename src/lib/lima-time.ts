/**
 * Date helpers for America/Lima. Peru has no daylight saving time, so the offset is a fixed UTC−5.
 * Instants stay in UTC epoch milliseconds; these helpers only interpret or display them.
 */
export const LIMA_TIME_ZONE = "America/Lima";
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Epoch for a Lima wall clock date (YYYY-MM-DD) and time (HH:MM). */
export function fromLima(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00-05:00`);
}

function shifted(epoch: number): Date {
  return new Date(epoch + LIMA_OFFSET_MS);
}

/** YYYY-MM-DD of the instant in Lima. */
export function limaDateKey(epoch: number): string {
  return shifted(epoch).toISOString().slice(0, 10);
}

/** HH:MM of the instant in Lima. */
export function limaTimeKey(epoch: number): string {
  return shifted(epoch).toISOString().slice(11, 16);
}

/** 0 = Sunday … 6 = Saturday, in Lima. */
export function limaWeekday(epoch: number): number {
  return shifted(epoch).getUTCDay();
}

export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** First Saturday strictly after the given instant's Lima date (design §6.8). */
export function nextSaturdayAfter(epoch: number): string {
  const weekday = limaWeekday(epoch);
  const days = (6 - weekday + 7) % 7 || 7;
  return addDays(limaDateKey(epoch), days);
}

export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export { DAY_MS };
