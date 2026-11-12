/**
 * Memo (日历备忘录) domain contract shared by the API and the frontend.
 *
 * A Memo is date-only: no time-of-day, no timezone. All storage and repeat
 * expansion work on `YYYY-MM-DD` date keys using UTC date arithmetic, so
 * rendering is independent of the viewer's timezone (M1 D1).
 */

/** `YYYY-MM-DD`. Zero-padded string comparison orders chronologically. */
export type DateKey = string;

export type MemoPriority = 'none' | 'low' | 'medium' | 'high';

export const MEMO_PRIORITIES: readonly MemoPriority[] = ['none', 'low', 'medium', 'high'];

/**
 * The 9 repeat rules (M1 2.3) plus `none`. Expansion is client-side
 * (`expandMemoToRange`, M1 D2); the API stores and returns raw Memos.
 */
export type MemoRepeatRule =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'monthlyByWeekday'
  | 'quarterly'
  | 'semiannual'
  | 'yearly';

export const MEMO_REPEAT_RULES: readonly MemoRepeatRule[] = [
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'monthlyByWeekday',
  'quarterly',
  'semiannual',
  'yearly',
];

export const MEMO_REPEAT_ALL: readonly MemoRepeatRule[] = ['none', ...MEMO_REPEAT_RULES];

export const MEMO_TITLE_MAX_LENGTH = 256;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface MemoDto {
  id: string;
  title: string;
  /** ISO date, e.g. "2026-11-12". Pure date, no time/timezone semantics. */
  date: DateKey;
  priority: MemoPriority;
  note: string | null;
  repeat: MemoRepeatRule;
  /** Inclusive last occurrence; null = repeats forever. */
  repeatEnd: DateKey | null;
  /** Non-repeating memos only: completion timestamp; null = not completed. */
  completedAt: string | null;
  /** Repeating memos only: date keys of completed instances. */
  completions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoDto {
  /** Client-generated UUID, submitted for idempotent create (E47). */
  id: string;
  title: string;
  /** YYYY-MM-DD. */
  date: DateKey;
  priority?: MemoPriority;
  note?: string | null;
  repeat?: MemoRepeatRule;
  /** YYYY-MM-DD or null; must not be before `date`. */
  repeatEnd?: DateKey | null;
}

export interface UpdateMemoDto {
  title?: string;
  date?: DateKey;
  priority?: MemoPriority;
  note?: string | null;
  repeat?: MemoRepeatRule;
  repeatEnd?: DateKey | null;
  /** Current updatedAt of the memo being edited; mismatch -> 409 (E49). */
  updatedAt?: string;
}

export interface SetMemoCompletionDto {
  /** The instance date being toggled (YYYY-MM-DD). */
  date: DateKey;
  completed: boolean;
}

// ---------------------------------------------------------------------------
// Date-key helpers (UTC arithmetic — timezone independent)
// ---------------------------------------------------------------------------

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function keyOfUtc(year: number, month0: number, day: number): DateKey {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function utcMs(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

/** True for a real calendar date like "2026-02-28" (rejects "2026-02-30"). */
export function isDateKey(value: string): boolean {
  const match = KEY_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  return keyOfUtc(...(ymdOfMs(utcMs(key) + days * 86_400_000) as [number, number, number]));
}

function ymdOfMs(ms: number): [number, number, number] {
  const date = new Date(ms);
  return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
}

function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Adds whole months to a date key, clamping the day to the target month's
 * last day (1/31 -> 2/28, 2/29 yearly -> 2/28). Monotonic: results never
 * decrease as `months` grows.
 */
export function addMonthsToKeyClamped(key: DateKey, months: number): DateKey {
  const [year, month0, day] = ymdOfMs(utcMs(key));
  const total = year * 12 + month0 + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth0 = total % 12;
  const clamped = Math.min(day, lastDayOfMonth(targetYear, targetMonth0));
  return keyOfUtc(targetYear, targetMonth0, clamped);
}

/** 1-based ordinal of the weekday within its month (e.g. 2nd Tuesday -> 2). */
export function weekdayOrdinalInMonth(key: DateKey): number {
  const [year, month0, day] = ymdOfMs(utcMs(key));
  const weekday = new Date(utcMs(key)).getUTCDay();
  const firstWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const firstMatch = 1 + ((weekday - firstWeekday + 7) % 7);
  return Math.floor((day - firstMatch) / 7) + 1;
}

/**
 * The `ordinal`-th `weekday` (0=Sun) of the given month, clamped to the
 * month's last such weekday when the ordinal does not occur (M1 H5).
 */
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, ordinal: number): DateKey {
  const last = lastDayOfMonth(year, month0);
  const firstWeekday = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const firstMatch = 1 + ((weekday - firstWeekday + 7) % 7);
  const day = Math.min(firstMatch + (ordinal - 1) * 7, last - ((last - firstMatch) % 7));
  return keyOfUtc(year, month0, day);
}

// ---------------------------------------------------------------------------
// Repeat expansion (frontend, M1 D2)
// ---------------------------------------------------------------------------

export interface MemoExpansionSource {
  date: DateKey;
  repeat: MemoRepeatRule;
  repeatEnd: DateKey | null;
}

/**
 * Expands a memo's repeat rule into the sorted, unique date keys it occurs
 * on within the closed range [fromKey, toKey]. `repeatEnd` (inclusive)
 * truncates the series. Pure dates: no timezone involved.
 */
export function expandMemoToRange(
  memo: MemoExpansionSource,
  fromKey: DateKey,
  toKey: DateKey,
): DateKey[] {
  const start = memo.date > fromKey ? memo.date : fromKey;
  const end = memo.repeatEnd !== null && memo.repeatEnd < toKey ? memo.repeatEnd : toKey;
  if (start > end) return [];

  const out: DateKey[] = [];
  const push = (key: DateKey) => {
    if (key >= start && key <= end && (out.length === 0 || out[out.length - 1] !== key)) {
      out.push(key);
    }
  };

  switch (memo.repeat) {
    case 'none':
      push(memo.date);
      break;

    case 'daily':
      for (let key = start; key <= end; key = addDaysToKey(key, 1)) push(key);
      break;

    case 'weekdays': {
      // Align to a Monday so the +1 walk visits every day once.
      const aligned = addDaysToKey(start, -((new Date(utcMs(start)).getUTCDay() + 6) % 7));
      for (let key = aligned; key <= end; key = addDaysToKey(key, 1)) {
        const dow = new Date(utcMs(key)).getUTCDay();
        if (dow >= 1 && dow <= 5) push(key);
      }
      break;
    }

    case 'weekly':
    case 'biweekly': {
      const step = memo.repeat === 'weekly' ? 7 : 14;
      let key = memo.date;
      while (key < start) key = addDaysToKey(key, step);
      for (; key <= end; key = addDaysToKey(key, step)) push(key);
      break;
    }

    case 'monthly':
    case 'quarterly':
    case 'semiannual':
    case 'yearly': {
      const stepMonths =
        memo.repeat === 'monthly'
          ? 1
          : memo.repeat === 'quarterly'
            ? 3
            : memo.repeat === 'semiannual'
              ? 6
              : 12;
      // Months between memo.date and start; bounded loop (12000 = 1000 years).
      let k = 0;
      let key = memo.date;
      while (key < start && k < 12000) {
        k += 1;
        key = addMonthsToKeyClamped(memo.date, k * stepMonths);
      }
      for (; key <= end && k < 12000; k += 1) {
        push(key);
        key = addMonthsToKeyClamped(memo.date, (k + 1) * stepMonths);
      }
      break;
    }

    case 'monthlyByWeekday': {
      const [year, month0] = ymdOfMs(utcMs(memo.date));
      const weekday = new Date(utcMs(memo.date)).getUTCDay();
      const ordinal = weekdayOrdinalInMonth(memo.date);
      let total = year * 12 + month0;
      const endTotal = ymdOfMs(utcMs(end));
      const endTotalMonths = endTotal[0] * 12 + endTotal[1];
      for (; total <= endTotalMonths && total < year * 12 + month0 + 12000; total += 1) {
        push(nthWeekdayOfMonth(Math.floor(total / 12), total % 12, weekday, ordinal));
      }
      break;
    }
  }
  return out;
}
