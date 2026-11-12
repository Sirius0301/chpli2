/**
 * Pure local-date helpers for the memo views. Memos are date-only (M1 D1):
 * the browser's local timezone only picks "today" and renders headers;
 * memo placement uses day keys derived from the view grid.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date only — hours/ms zeroed. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Sunday-first start of the week containing `date` (M1 三视图改造). */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  return addDays(d, -d.getDay()); // Sunday = 0
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** "YYYY-MM-DD" for a local date (used as a stable day key). */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Parse a day key back into a local Date. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * The 6x7 grid of days for a month view: the Sunday of the week containing
 * the 1st, through 42 days.
 */
export function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** True when the two local dates fall on the same calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Value for <input type="date"> from a local Date. */
export function toDateInput(date: Date): string {
  return dayKey(date);
}
