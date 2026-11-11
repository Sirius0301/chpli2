import type {
  ApiErrorBody,
  CalendarDto,
  CreateCalendarDto,
  CreateEventDto,
  DueReminderDto,
  EventDto,
  HolidayEntryDto,
  ReminderDto,
  ReminderInput,
  UpdateCalendarDto,
  UpdateEventDto,
} from '@chpli2/shared';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  if (!response.ok) {
    let errorCode = 'UNKNOWN';
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      errorCode = typeof body.errorCode === 'string' ? body.errorCode : errorCode;
      message = typeof body.message === 'string' ? body.message : message;
    } catch {
      /* body was not JSON; keep defaults */
    }
    throw new ApiError(response.status, errorCode, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// -- Calendars ---------------------------------------------------------------

export function listCalendars(): Promise<CalendarDto[]> {
  return request('/api/calendar/calendars');
}

export function createCalendar(body: CreateCalendarDto): Promise<CalendarDto> {
  return request('/api/calendar/calendars', json('POST', body));
}

export function updateCalendar(id: string, body: UpdateCalendarDto): Promise<CalendarDto> {
  return request(`/api/calendar/calendars/${id}`, json('PATCH', body));
}

export function deleteCalendar(id: string, moveTo?: string, deleteEvents?: boolean): Promise<void> {
  const params = new URLSearchParams();
  if (moveTo) params.set('move_to', moveTo);
  if (deleteEvents) params.set('delete_events', 'true');
  const suffix = params.size ? `?${params.toString()}` : '';
  return request(`/api/calendar/calendars/${id}${suffix}`, { method: 'DELETE' });
}

// -- Events --------------------------------------------------------------------

export function listEvents(from: string, to: string, calendarIds?: string[]): Promise<EventDto[]> {
  const params = new URLSearchParams({ from, to });
  if (calendarIds?.length) params.set('calendar_ids', calendarIds.join(','));
  return request(`/api/calendar/events?${params.toString()}`);
}

export function createEvent(body: CreateEventDto): Promise<EventDto> {
  return request('/api/calendar/events', json('POST', body));
}

export function getEvent(id: string): Promise<EventDto> {
  return request(`/api/calendar/events/${id}`);
}

export function updateEvent(id: string, body: UpdateEventDto): Promise<EventDto> {
  return request(`/api/calendar/events/${id}`, json('PATCH', body));
}

export function deleteEvent(id: string): Promise<void> {
  return request(`/api/calendar/events/${id}`, { method: 'DELETE' });
}

// -- Reminders -----------------------------------------------------------------

export function listReminders(eventId: string): Promise<ReminderDto[]> {
  return request(`/api/calendar/events/${eventId}/reminders`);
}

export function replaceReminders(eventId: string, reminders: ReminderInput[]): Promise<ReminderDto[]> {
  return request(`/api/calendar/events/${eventId}/reminders`, json('PUT', { reminders }));
}

export function listDueReminders(before: string, calendarIds?: string[]): Promise<DueReminderDto[]> {
  const params = new URLSearchParams({ before });
  if (calendarIds?.length) params.set('calendar_ids', calendarIds.join(','));
  return request(`/api/calendar/reminders/due?${params.toString()}`);
}

// -- Holidays --------------------------------------------------------------------

export function listHolidays(
  regionCodes: string[],
  from: string,
  to: string,
  lang: string,
): Promise<HolidayEntryDto[]> {
  if (!regionCodes.length) return Promise.resolve([]);
  const params = new URLSearchParams({
    region_codes: regionCodes.join(','),
    from,
    to,
    lang,
  });
  return request(`/api/calendar/holidays?${params.toString()}`);
}

// -- Travel-synced projection (read-only) ------------------------------------------

export interface TravelEventDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  source: { module: 'travel'; type: 'transport'; id: string; tripId: string };
}

export function listTravelEvents(from: string, to: string): Promise<TravelEventDto[]> {
  const params = new URLSearchParams({ from, to });
  return request(`/api/calendar/travel-events?${params.toString()}`);
}

// -- Formatting ----------------------------------------------------------------------

/** Localized, user-timezone display format for an ISO 8601 string. */
export function formatDateTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
