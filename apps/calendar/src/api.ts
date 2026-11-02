import type { ApiErrorBody, CalendarEventDto } from '@chpli2/shared';

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

export async function listEvents(): Promise<CalendarEventDto[]> {
  let response: Response;
  try {
    response = await fetch('/api/calendar/events');
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
  return (await response.json()) as CalendarEventDto[];
}

/** Localized, user-timezone display format for an ISO 8601 string. */
export function formatDateTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
