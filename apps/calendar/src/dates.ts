/**
 * Pure local-date helpers for the calendar views. The browser's local
 * timezone drives view rendering; language and date format are handled
 * separately by the caller (F4 will add full timezone support).
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

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/** Monday-first start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(d, -dow);
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
 * The 6x7 grid of days for a month view: the Monday of the week containing
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

/** Value for <input type="datetime-local"> from a local Date. */
export function toLocalInput(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Value for <input type="date"> from a local Date. */
export function toDateInput(date: Date): string {
  return dayKey(date);
}

export function parseLocalInput(value: string): Date {
  return new Date(value);
}

/** Minutes since local midnight, snapped down to a step. */
export function minutesOfDay(date: Date, snapMinutes = 1): number {
  const raw = date.getHours() * 60 + date.getMinutes();
  return Math.floor(raw / snapMinutes) * snapMinutes;
}

/**
 * Splits an event [startAt, endAt) into per-day segments keyed by local day
 * key, clipping at the day boundary. Cross-midnight events yield several
 * segments (E5).
 */
export function splitByDay(startAt: Date, endAt: Date): { key: string; from: Date; to: Date }[] {
  const segments: { key: string; from: Date; to: Date }[] = [];
  let cursor = startAt;
  while (cursor < endAt) {
    const dayStart = startOfDay(cursor);
    const dayEnd = addDays(dayStart, 1);
    const to = endAt < dayEnd ? endAt : dayEnd;
    segments.push({ key: dayKey(dayStart), from: cursor, to });
    cursor = to;
  }
  return segments;
}

/** Overlap layout for timed events in the week/day view (A10). */
export interface PositionedEvent<T> {
  item: T;
  startMinutes: number;
  endMinutes: number;
  /** 0-based column within its overlap cluster. */
  column: number;
  /** Number of columns in the cluster (events may render 1/cluster wide). */
  columns: number;
}

export function layoutOverlaps<T>(
  items: { item: T; startMinutes: number; endMinutes: number }[],
): PositionedEvent<T>[] {
  interface Node extends PositionedEvent<T> {}
  const nodes: Node[] = items
    .map((i) => ({
      item: i.item,
      startMinutes: i.startMinutes,
      endMinutes: i.endMinutes,
      column: 0,
      columns: 1,
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  // Cluster events that transitively overlap, then assign columns greedily.
  let cluster: Node[] = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const columns: number[] = [];
    for (const node of cluster) {
      let col = columns.findIndex((end) => end <= node.startMinutes);
      if (col === -1) {
        col = columns.length;
        columns.push(node.endMinutes);
      } else {
        columns[col] = node.endMinutes;
      }
      node.column = col;
    }
    for (const node of cluster) node.columns = columns.length;
    cluster = [];
    clusterEnd = -1;
  };

  for (const node of nodes) {
    if (cluster.length && node.startMinutes >= clusterEnd) flush();
    cluster.push(node);
    clusterEnd = Math.max(clusterEnd, node.endMinutes);
  }
  flush();
  return nodes.map(({ item, startMinutes, endMinutes, column, columns }) => ({
    item,
    startMinutes,
    endMinutes,
    column,
    columns,
  }));
}
