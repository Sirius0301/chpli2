/**
 * Pure date/time helpers for the calendar module. All functions are
 * deterministic and side-effect free so they can be unit-tested directly.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC-midnight Date for a local calendar date (year, month 1-12, day 1-31). */
export function utcMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Builds the stored start/end pair for an all-day event spanning
 * [startDate, endDate] inclusive (Apple semantics):
 * startAt = startDate 00:00Z, endAt = (endDate + 1) 00:00Z (exclusive).
 */
export function allDayRange(startDate: Date, endDate: Date): {
  startAt: Date;
  endAt: Date;
} {
  return { startAt: startDate, endAt: new Date(endDate.getTime() + DAY_MS) };
}

/**
 * Date keys ("YYYY-MM-DD", UTC) of every day an event touches, for splitting
 * multi-day and cross-midnight events into per-day segments (E5).
 * The end instant is exclusive, matching the storage convention.
 */
export function eventDayKeys(startAt: Date, endAt: Date): string[] {
  const keys: string[] = [];
  const lastInclusive = endAt.getTime() - 1;
  const startDay = startAt.getTime() - (startAt.getTime() % DAY_MS);
  const endDay = lastInclusive - (lastInclusive % DAY_MS);
  for (let t = startDay; t <= endDay; t += DAY_MS) {
    keys.push(dayKey(new Date(t)));
  }
  return keys;
}

/** "YYYY-MM-DD" of the UTC day containing the instant. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * True when [startA, endA) overlaps the half-open window [from, to).
 * Used for view-window event fetching so multi-day events are not cut off.
 */
export function overlapsWindow(
  startAt: Date,
  endAt: Date,
  from: Date,
  to: Date,
): boolean {
  return startAt < to && endAt > from;
}

/**
 * Recomputes the trigger instant of a reminder after its event moved (E7).
 * Status transition: a pending reminder whose new trigger time has already
 * passed is dismissed instead of firing retroactively (E13).
 */
export function recomputedReminder(
  startAt: Date,
  offsetDays: number,
  now: Date,
): { triggerAt: Date; status: 'pending' | 'dismissed' } {
  const triggerAt = new Date(startAt.getTime() - offsetDays * DAY_MS);
  return { triggerAt, status: triggerAt <= now ? 'dismissed' : 'pending' };
}
