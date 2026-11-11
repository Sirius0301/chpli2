import type { EventDto } from '@chpli2/shared';
import { utcToFloatingWall } from '@chpli2/shared';
import { addDays } from './dates';

/** Unified display item for the calendar views. */
export interface DisplayEvent {
  id: string;
  title: string;
  /** Exclusive end (matches the storage convention). */
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  color: string;
  calendarId: string;
  kind: 'event' | 'travel' | 'holiday';
  /** Read-only items (holidays, travel projection) cannot be edited or dragged. */
  readonly: boolean;
  /** Present for user events that can be edited (carries optimistic-lock state). */
  source?: EventDto;
  tripId?: string;
}

/**
 * Floating events (timezone = null, non-all-day) store a UTC wall clock that
 * must render identically in every viewer timezone. Reinterpreting the stored
 * instant's UTC wall clock as a browser-local instant makes every existing
 * view render the same date and time everywhere (E18).
 */
function toDisplayInstant(iso: string, floating: boolean): Date {
  const instant = new Date(iso);
  if (!floating) return instant;
  const wall = utcToFloatingWall(instant);
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
}

/** Converts an API event into the display model. */
export function displayEvent(
  event: EventDto,
  color: string,
): DisplayEvent {
  const floating = event.timezone === null && !event.allDay;
  return {
    id: event.id,
    title: event.title,
    startAt: toDisplayInstant(event.startAt, floating),
    endAt: toDisplayInstant(event.endAt, floating),
    allDay: event.allDay,
    color,
    calendarId: event.calendarId,
    kind: 'event',
    readonly: false,
    source: event,
  };
}

/** Clamps an interval to a week row and returns its column span, or null. */
export function weekSpan(
  event: DisplayEvent,
  weekStart: Date,
  weekEnd: Date,
): { startCol: number; endCol: number } | null {
  const start = event.startAt < weekStart ? weekStart : event.startAt;
  const inclusiveEnd = new Date(event.endAt.getTime() - 1);
  const end = inclusiveEnd >= weekEnd ? new Date(weekEnd.getTime() - 1) : inclusiveEnd;
  if (start > end) return null;
  let startCol = -1;
  let endCol = -1;
  for (let i = 0; i < 7; i += 1) {
    const dayStart = addDays(weekStart, i);
    const dayEnd = addDays(dayStart, 1);
    if (start < dayEnd && end >= dayStart) {
      if (startCol === -1) startCol = i;
      endCol = i;
    }
  }
  return startCol === -1 ? null : { startCol, endCol };
}
