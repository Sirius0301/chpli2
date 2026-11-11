/** Trip identity type. PLAN and MEMORY are not mutually exclusive over time
 *  and are never switched automatically. */
export type TripType = 'PLAN' | 'MEMORY';

/** Hierarchy levels for travel routing. Routes may only connect same-level endpoints. */
export type RouteLevel = 'COUNTRY' | 'CITY' | 'LOCATION';

export type TransportMode =
  | 'FLIGHT'
  | 'TRAIN'
  | 'BUS'
  | 'FERRY'
  | 'SUBWAY'
  | 'CAR'
  | 'WALK'
  | 'OTHER';

export const TRANSPORT_MODES: readonly TransportMode[] = [
  'FLIGHT',
  'TRAIN',
  'BUS',
  'FERRY',
  'SUBWAY',
  'CAR',
  'WALK',
  'OTHER',
];

export const ROUTE_LEVELS: readonly RouteLevel[] = ['COUNTRY', 'CITY', 'LOCATION'];

// ---------------------------------------------------------------------------
// Calendar module (F1+F2)
// ---------------------------------------------------------------------------

/** `custom` calendars are user-owned; `subscription` calendars are read-only
 * layers such as public holidays. */
export type CalendarType = 'custom' | 'subscription';

export const CALENDAR_TYPES: readonly CalendarType[] = ['custom', 'subscription'];

/** Reminder presets. `month` is the upper bound (30 days ahead). */
export type ReminderPreset = 'month' | 'week' | 'day' | 'custom';

export const REMINDER_PRESETS: readonly ReminderPreset[] = ['month', 'week', 'day', 'custom'];

export type ReminderStatus = 'pending' | 'sent' | 'dismissed';

export const REMINDER_STATUSES: readonly ReminderStatus[] = ['pending', 'sent', 'dismissed'];

/** How many days ahead a reminder may fire at most (one month). */
export const REMINDER_OFFSET_MAX_DAYS = 30;

export const REMINDER_OFFSET_MIN_DAYS = 1;

/** Preset -> concrete day offset. */
export const REMINDER_PRESET_OFFSET_DAYS: Record<ReminderPreset, number> = {
  month: 30,
  week: 7,
  day: 1,
  custom: 1, // actual value comes from offsetDays for `custom`
};

/** Holiday regions: whole countries or country-state combinations. */
export const HOLIDAY_REGION_CODES = [
  'CN',
  ...[
    'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
  ].map((s) => `DE-${s}`),
  ...[
    'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI',
    'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU',
  ].map((c) => `CH-${c}`),
] as const;

export type HolidayRegionCode = (typeof HOLIDAY_REGION_CODES)[number];
