/**
 * Timezone helpers for the calendar module (F4). Pure and side-effect free;
 * runs in both Node and the browser (relies only on Intl).
 *
 * Semantics (see the F4 task book):
 * - Fixed-zone event: instant anchored; `zonedTimeToUtc` resolves wall time.
 * - Floating event (timezone = null): wall-clock anchored, stored as UTC wall
 *   clock ("09:00 wherever you are" is stored as 09:00Z).
 * - Spring-forward gaps (nonexistent local time) resolve to null (E15).
 * - Fall-back ambiguity resolves to the earlier occurrence (D4), matching
 *   ECMAScript `new Date` behaviour.
 */

export interface WallClock {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let dtf = formatterCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, dtf);
  }
  return dtf;
}

/** True when `timeZone` is a valid IANA timezone name (E19). */
export function isValidTimezone(timeZone: string): boolean {
  if (!timeZone || timeZone !== timeZone.trim()) return false;
  try {
    formatterFor(timeZone).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock fields of the instant as seen in `timeZone`. */
export function wallClockOf(instant: Date, timeZone: string): WallClock {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // hourCycle h23 yields "24" for midnight
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetMinutes(timeZone: string, instant: Date): number {
  const wc = wallClockOf(instant, timeZone);
  const asUTC = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  const instantSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUTC - instantSeconds) / 60000);
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

/**
 * Resolves a wall-clock time in `timeZone` to a UTC instant.
 * Returns null when the local time does not exist (spring-forward gap, E15).
 * Ambiguous times (fall-back) resolve to the earlier occurrence (D4).
 */
export function zonedTimeToUtc(wall: WallClock, timeZone: string): Date | null {
  const wallMs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  let utcMs = wallMs;
  for (let i = 0; i < 4; i += 1) {
    const next = wallMs - offsetMinutes(timeZone, new Date(utcMs)) * 60000;
    if (next === utcMs) break;
    utcMs = next;
  }
  if (!sameWallClock(wallClockOf(new Date(utcMs), timeZone), wall)) {
    return null; // nonexistent local time (spring-forward gap, E15)
  }
  // Ambiguous local time (fall-back): prefer the earlier occurrence (D4).
  for (let delta = 30; delta <= 180; delta += 30) {
    const earlierMs = utcMs - delta * 60000;
    if (sameWallClock(wallClockOf(new Date(earlierMs), timeZone), wall)) {
      utcMs = earlierMs;
      break;
    }
  }
  return new Date(utcMs);
}

/**
 * Storage instant of a floating wall-clock time: the wall clock read as UTC
 * ("09:00 wherever you are" -> 09:00Z). Displayed identically in every zone.
 */
export function floatingWallToUtc(wall: WallClock): Date {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second));
}

/** The stored floating instant expressed as its UTC wall clock. */
export function utcToFloatingWall(instant: Date): WallClock {
  return wallClockOf(instant, 'UTC');
}

export type EventTimeInput =
  | { kind: 'instant'; instant: Date }
  | { kind: 'wall'; wall: WallClock };

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const OFFSET_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parses an API datetime string into either an absolute instant (offset or Z
 * present — backward compatible with F1+F2 clients) or a wall-clock time
 * (no offset — interpreted by the caller in the event's timezone).
 */
export function parseEventTime(value: string): EventTimeInput | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (OFFSET_SUFFIX_RE.test(trimmed)) {
    const instant = new Date(trimmed);
    return Number.isNaN(instant.getTime()) ? null : { kind: 'instant', instant };
  }
  const match = WALL_RE.exec(trimmed);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const wall: WallClock = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: second === undefined ? 0 : Number(second),
  };
  if (
    wall.month < 1 ||
    wall.month > 12 ||
    wall.day < 1 ||
    wall.day > 31 ||
    wall.hour > 23 ||
    wall.minute > 59 ||
    wall.second > 59
  ) {
    return null;
  }
  return { kind: 'wall', wall };
}

/** "YYYY-MM-DDTHH:mm" from a wall clock (for datetime-local inputs / API payloads). */
export function wallClockToInput(wall: WallClock): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}
