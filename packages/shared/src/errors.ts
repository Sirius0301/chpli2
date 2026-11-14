export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TRIP_NOT_FOUND: 'TRIP_NOT_FOUND',
  TRANSPORT_NOT_FOUND: 'TRANSPORT_NOT_FOUND',
  ROUTE_SAME_ENDPOINT: 'ROUTE_SAME_ENDPOINT',
  ROUTE_LEVEL_MISMATCH: 'ROUTE_LEVEL_MISMATCH',
  ROUTE_CITY_MISMATCH: 'ROUTE_CITY_MISMATCH',
  TIME_ORDER_INVALID: 'TIME_ORDER_INVALID',
  CALENDAR_NOT_FOUND: 'CALENDAR_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  /** 409: deleting a calendar that has events requires an explicit target. */
  CALENDAR_DELETE_REQUIRES_TARGET: 'CALENDAR_DELETE_REQUIRES_TARGET',
  /** 422: a user must keep at least one custom calendar. */
  LAST_CUSTOM_CALENDAR: 'LAST_CUSTOM_CALENDAR',
  /** 422: endAt must be after startAt. */
  EVENT_TIME_INVALID: 'EVENT_TIME_INVALID',
  /** 422: reminder offset outside 1..30 days. */
  REMINDER_OFFSET_INVALID: 'REMINDER_OFFSET_INVALID',
  /** 422: the target calendar is read-only (subscription). */
  CALENDAR_READONLY: 'CALENDAR_READONLY',
  /** 409: optimistic-lock conflict on concurrent edits. */
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  /** 422: subscription calendars require a region code. */
  HOLIDAY_REGION_REQUIRED: 'HOLIDAY_REGION_REQUIRED',
  /** 401: missing or invalid bearer token. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** 409: username already taken at registration. */
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  /** 401: wrong credentials (unknown user or bad password, same message). */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** 409: email already bound at registration (M0 增强). */
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  /** 409: phone already bound at registration (M0 增强). */
  PHONE_TAKEN: 'PHONE_TAKEN',
  /** 401: wrong/expired/consumed/over-attempted login code. */
  INVALID_CODE: 'INVALID_CODE',
  /** 429: login-code resend requested inside the cooldown window. */
  CODE_COOLDOWN: 'CODE_COOLDOWN',
  /** 404: memo missing or owned by another user (M0 D5). */
  MEMO_NOT_FOUND: 'MEMO_NOT_FOUND',
  /** 422: completion date is not an actual occurrence of the repeat rule (E50). */
  MEMO_DATE_NOT_INSTANCE: 'MEMO_DATE_NOT_INSTANCE',
  /** 503: object storage (MinIO) is unreachable (M3 E62). */
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  /** 404: note missing or owned by another user (N1 E80, M0 D5). */
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  /** 404: note version missing (N2 E83). */
  NOTE_VERSION_NOT_FOUND: 'NOTE_VERSION_NOT_FOUND',
  /** 404: bookmark missing or owned by another user (B1 E94, M0 D5). */
  BOOKMARK_NOT_FOUND: 'BOOKMARK_NOT_FOUND',
  /** 404: goal missing or owned by another user (G1 E101, M0 D5). */
  GOAL_NOT_FOUND: 'GOAL_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
