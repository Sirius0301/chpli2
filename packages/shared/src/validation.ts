import type { RouteEndpointRef } from './dto.js';
import {
  REMINDER_OFFSET_MAX_DAYS,
  REMINDER_OFFSET_MIN_DAYS,
} from './types.js';

export type RouteValidationErrorCode =
  | 'ROUTE_SAME_ENDPOINT'
  | 'ROUTE_LEVEL_MISMATCH'
  | 'ROUTE_CITY_MISMATCH';

export type RouteValidationResult =
  | { ok: true }
  | { ok: false; code: RouteValidationErrorCode };

/**
 * Validates that a route only connects same-level endpoints:
 * COUNTRY<->COUNTRY, CITY<->CITY, or LOCATION<->LOCATION where both locations
 * belong to the same city. Cross-level and cross-city-location routes are forbidden.
 *
 * For LOCATION endpoints the caller must supply the cityId of each endpoint
 * (`originCityId` / `destinationCityId`), resolved from its own data.
 */
export function validateRoute(
  origin: RouteEndpointRef,
  destination: RouteEndpointRef,
  ctx: { originCityId?: string; destinationCityId?: string },
): RouteValidationResult {
  if (origin.id === destination.id && origin.level === destination.level) {
    return { ok: false, code: 'ROUTE_SAME_ENDPOINT' };
  }
  if (origin.level !== destination.level) {
    return { ok: false, code: 'ROUTE_LEVEL_MISMATCH' };
  }
  if (origin.level === 'LOCATION') {
    if (!ctx.originCityId || !ctx.destinationCityId) {
      return { ok: false, code: 'ROUTE_CITY_MISMATCH' };
    }
    if (ctx.originCityId !== ctx.destinationCityId) {
      return { ok: false, code: 'ROUTE_CITY_MISMATCH' };
    }
  }
  return { ok: true };
}

/**
 * Returns true when both planned times exist and arrival is not before departure.
 * Missing values are allowed (partial data entry).
 */
export function isPlannedTimeOrderValid(
  plannedDepartureAt: string | null | undefined,
  plannedArrivalAt: string | null | undefined,
): boolean {
  if (!plannedDepartureAt || !plannedArrivalAt) return true;
  return new Date(plannedArrivalAt).getTime() >= new Date(plannedDepartureAt).getTime();
}

export function isActualTimeOrderValid(
  actualDepartureAt: string | null | undefined,
  actualArrivalAt: string | null | undefined,
): boolean {
  if (!actualDepartureAt || !actualArrivalAt) return true;
  return new Date(actualArrivalAt).getTime() >= new Date(actualDepartureAt).getTime();
}

/** Stable, unique sync key for a transport's calendar event. Idempotency anchor. */
export function transportSyncKey(transportId: string): string {
  return `travel:transport:${transportId}`;
}

// ---------------------------------------------------------------------------
// Calendar module (F1+F2)
// ---------------------------------------------------------------------------

/**
 * Reminder trigger instant for an event start and a day offset.
 * All-day events are date-anchored UTC midnights, so plain day arithmetic is
 * exact for them; timed events use the same fixed 24h day.
 */
export function reminderTriggerAt(startAt: Date, offsetDays: number): Date {
  return new Date(startAt.getTime() - offsetDays * 24 * 60 * 60 * 1000);
}

/** Valid reminder offsets: 1..30 days (30 = one month, the upper bound). */
export function isReminderOffsetValid(offsetDays: number): boolean {
  return (
    Number.isInteger(offsetDays) &&
    offsetDays >= REMINDER_OFFSET_MIN_DAYS &&
    offsetDays <= REMINDER_OFFSET_MAX_DAYS
  );
}
