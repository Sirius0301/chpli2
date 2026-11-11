import type {
  CalendarType,
  ReminderPreset,
  ReminderStatus,
  RouteLevel,
  TransportMode,
  TripType,
} from './types.js';

/** A route endpoint reference. The caller resolves the city context for LOCATION level. */
export interface RouteEndpointRef {
  level: RouteLevel;
  id: string;
}

export interface CountryDto {
  id: string;
  name: string;
  code: string;
}

export interface CityDto {
  id: string;
  countryId: string;
  name: string;
}

export interface LocationDto {
  id: string;
  cityId: string;
  name: string;
}

export interface RouteEndpointDto {
  level: RouteLevel;
  id: string;
  name: string;
  cityId?: string;
}

export interface CreateTripDto {
  title: string;
  type: TripType;
}

export interface CreateTransportDto {
  mode: TransportMode;
  origin: RouteEndpointRef;
  destination: RouteEndpointRef;
  /** ISO 8601 strings with offset, e.g. "2026-12-01T09:30:00+01:00". May be past dates. */
  plannedDepartureAt?: string | null;
  plannedArrivalAt?: string | null;
  actualDepartureAt?: string | null;
  actualArrivalAt?: string | null;
  /** Whether this transport should sync to the calendar. Ignored for MEMORY trips. */
  syncToCalendar?: boolean;
}

export interface UpdateTransportDto {
  mode?: TransportMode;
  origin?: RouteEndpointRef;
  destination?: RouteEndpointRef;
  plannedDepartureAt?: string | null;
  plannedArrivalAt?: string | null;
  actualDepartureAt?: string | null;
  actualArrivalAt?: string | null;
  syncToCalendar?: boolean;
}

export interface CalendarSyncStateDto {
  eventId: string;
  syncKey: string;
  syncedAt: string;
  status: 'SYNCED' | 'PENDING_DELETE';
}

export interface TransportDto {
  id: string;
  tripId: string;
  mode: TransportMode;
  origin: RouteEndpointDto;
  destination: RouteEndpointDto;
  plannedDepartureAt: string | null;
  plannedArrivalAt: string | null;
  actualDepartureAt: string | null;
  actualArrivalAt: string | null;
  calendarSync: CalendarSyncStateDto | null;
}

export interface TripDto {
  id: string;
  title: string;
  type: TripType;
  createdAt: string;
  updatedAt: string;
  transports: TransportDto[];
}

export interface CalendarEventDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  source: {
    module: 'travel';
    type: 'transport';
    id: string;
    tripId: string;
  };
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errorCode: string;
}

// ---------------------------------------------------------------------------
// Calendar module (F1+F2)
// ---------------------------------------------------------------------------

export interface CalendarDto {
  id: string;
  name: string;
  /** Hex color, e.g. "#0A84FF". */
  color: string;
  type: CalendarType;
  /** Subscription calendars are read-only layers (holidays). */
  readonly: boolean;
  /** Subscription region, e.g. "CN" / "DE-BY" / "CH-ZH"; null for custom. */
  regionCode: string | null;
  /** Exactly one calendar is the user's default. */
  isDefault: boolean;
  sortOrder: number;
  /** Hidden calendars do not show their events or reminders in any view. */
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventDto {
  id: string;
  calendarId: string;
  title: string;
  /** ISO 8601. All-day events are date-anchored UTC midnights:
   * startAt = first day 00:00Z, endAt = day after last day 00:00Z (exclusive). */
  startAt: string;
  endAt: string;
  allDay: boolean;
  /** IANA timezone recorded at creation. */
  timezone: string;
  location: string | null;
  description: string | null;
  /** Reserved for F7 cross-module sync; null for user-created events. */
  sourceModule: string | null;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderDto {
  id: string;
  eventId: string;
  offsetDays: number;
  preset: ReminderPreset;
  status: ReminderStatus;
  triggerAt: string;
  sentAt: string | null;
}

/** A pending reminder enriched for the sidebar due list. */
export interface DueReminderDto extends ReminderDto {
  event: {
    id: string;
    title: string;
    startAt: string;
    allDay: boolean;
    calendarId: string;
    calendarColor: string;
  };
}

export interface HolidayEntryDto {
  id: string;
  regionCode: string;
  /** ISO date, e.g. "2026-10-03". */
  date: string;
  /** Localized holiday name (zh -> en -> de fallback applied server-side). */
  name: string;
  /** CN only: true marks a moved workday (调休). */
  isWorkday: boolean;
}

export interface CreateCalendarDto {
  name: string;
  color: string;
  type: CalendarType;
  /** Required when type = subscription. */
  regionCode?: string | null;
}

export interface UpdateCalendarDto {
  name?: string;
  color?: string;
  hidden?: boolean;
  /** Set true to make this calendar the default. */
  isDefault?: boolean;
  sortOrder?: number;
}

export interface CreateEventDto {
  /** Client-generated UUID, submitted for idempotent create (E11). */
  id: string;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  timezone?: string;
  location?: string | null;
  description?: string | null;
}

export interface UpdateEventDto {
  calendarId?: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  timezone?: string;
  location?: string | null;
  description?: string | null;
  /** Current updatedAt of the event being edited; mismatch -> 409 (E14). */
  updatedAt?: string;
}

export interface ReminderInput {
  offsetDays: number;
  preset: ReminderPreset;
}

/** Replaces the reminder set of an event wholesale. */
export interface ReplaceRemindersDto {
  reminders: ReminderInput[];
}
