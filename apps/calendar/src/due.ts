import type { DisplayMemoInstance } from './view-model';

/**
 * Due-soon window (M4 D1): overdue back to one week, upcoming three days
 * (inclusive of today).
 */
export const DUE_OVERDAYS_DAYS = 7;
export const DUE_UPCOMING_DAYS = 3;

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

export function dueFromKey(todayKey: string): string {
  return shiftKey(todayKey, -DUE_OVERDAYS_DAYS);
}

export function dueToKey(todayKey: string): string {
  // Window is inclusive of today (used only for filtering; API `to` is
  // exclusive, so callers pass dueToExclusiveKey(today) when querying).
  return shiftKey(todayKey, DUE_UPCOMING_DAYS);
}

/** Exclusive upper bound for the due-window API query (D5). */
export function dueToExclusiveKey(todayKey: string): string {
  return shiftKey(todayKey, DUE_UPCOMING_DAYS + 1);
}

/** Polling cadence for due data (M4 D6). */
export const DUE_POLL_MS = 60_000;

/** Uncompleted instances within the due window, oldest first (M4 D1). */
export function dueInstances(
  instances: DisplayMemoInstance[],
  todayKey: string,
): DisplayMemoInstance[] {
  const from = dueFromKey(todayKey);
  const to = dueToKey(todayKey);
  return instances
    .filter((i) => !i.completed && i.date >= from && i.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/**
 * Day keys carrying at least one uncompleted instance due TODAY (M4 D7) —
 * the month-view badge set. Only today qualifies, never upcoming days.
 */
export function dueTodayKeys(
  instances: DisplayMemoInstance[],
  todayKey: string,
): Set<string> {
  const keys = new Set<string>();
  for (const instance of instances) {
    if (!instance.completed && instance.date === todayKey) keys.add(instance.date);
  }
  return keys;
}

/** Human "days left" bucket for the due card: negative = overdue. */
export function daysUntil(dateKey: string, todayKey: string): number {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
