import type { RouteLevel, TransportMode, TripType } from './types.js';

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
