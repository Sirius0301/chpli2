import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { api, createTestApp, migrateDeploy, registerTestUser, resetDatabase } from '../helpers';

/**
 * Integration coverage of the Calendar F4 slice: fixed-zone events,
 * floating time, wall-clock inputs, DST gap/ambiguity (E15/E16), timezone
 * switching semantics (D2/E20/E21) and IANA validation (E19).
 */

interface CalendarDto {
  id: string;
  name: string;
}

interface EventDto {
  id: string;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timezone: string | null;
  updatedAt: string;
}

interface ReminderDto {
  id: string;
  eventId: string;
  offsetDays: number;
  preset: string;
  status: string;
  triggerAt: string;
}

let app: INestApplication;
let calendarId: string;
let seq = 0;

/** Deterministic client-generated uuid (idempotency anchor). */
function nextId(): string {
  seq += 1;
  return `f4000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}

async function createCalendar(): Promise<CalendarDto> {
  const res = await api(app)
    .post('/api/calendar/calendars')
    .send({ name: 'F4', color: '#0A84FF', type: 'custom' });
  expect(res.status).toBe(201);
  return res.body as CalendarDto;
}

async function postEvent(
  body: Record<string, unknown>,
): Promise<{ status: number; body: EventDto & { message?: string; errorCode?: string } }> {
  const res = await api(app).post('/api/calendar/events').send(body);
  return { status: res.status, body: res.body };
}

async function createEvent(
  startAt: string,
  endAt: string,
  extra: Record<string, unknown> = {},
): Promise<EventDto> {
  const { status, body } = await postEvent({
    id: nextId(),
    calendarId,
    title: 'F4 event',
    startAt,
    endAt,
    ...extra,
  });
  expect(status, JSON.stringify(body)).toBe(201);
  return body as EventDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  await registerTestUser(app, 'cal-f4-tester');
  calendarId = (await createCalendar()).id;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('fixed-zone events (wall-clock inputs)', () => {
  it('resolves wall times in the event timezone (Berlin winter, UTC+1)', async () => {
    const event = await createEvent('2026-01-15T09:00', '2026-01-15T10:00', {
      timezone: 'Europe/Berlin',
    });
    expect(event.timezone).toBe('Europe/Berlin');
    expect(event.startAt).toBe('2026-01-15T08:00:00.000Z');
    expect(event.endAt).toBe('2026-01-15T09:00:00.000Z');
  });

  it('resolves wall times in the event timezone (Berlin summer, UTC+2)', async () => {
    const event = await createEvent('2026-07-15T09:00', '2026-07-15T10:00', {
      timezone: 'Europe/Berlin',
    });
    expect(event.startAt).toBe('2026-07-15T07:00:00.000Z');
  });

  it('still accepts absolute instants (backward compatible)', async () => {
    const event = await createEvent('2026-12-01T01:30:00.000Z', '2026-12-01T02:30:00.000Z', {
      timezone: 'Asia/Shanghai',
    });
    expect(event.startAt).toBe('2026-12-01T01:30:00.000Z');
  });

  it('rejects an unknown timezone name (E19)', async () => {
    const { status, body } = await postEvent({
      id: nextId(),
      calendarId,
      title: 'Bad zone',
      startAt: '2026-01-15T09:00',
      endAt: '2026-01-15T10:00',
      timezone: 'Mars/Olympus',
    });
    expect(status).toBe(422);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });
});

describe('DST boundaries', () => {
  it('rejects a nonexistent spring-forward wall time (E15)', async () => {
    const { status, body } = await postEvent({
      id: nextId(),
      calendarId,
      title: 'Gap',
      startAt: '2026-03-29T02:30',
      endAt: '2026-03-29T03:30',
      timezone: 'Europe/Berlin',
    });
    expect(status).toBe(422);
    expect(body.errorCode).toBe('EVENT_TIME_INVALID');
  });

  it('resolves an ambiguous fall-back wall time to the earlier occurrence (E16/D4)', async () => {
    const event = await createEvent('2026-10-25T02:30', '2026-10-25T03:30', {
      timezone: 'Europe/Berlin',
    });
    expect(event.startAt).toBe('2026-10-25T00:30:00.000Z');
    expect(event.endAt).toBe('2026-10-25T02:30:00.000Z');
  });

  it('keeps all-day events date-anchored across a DST boundary (E17)', async () => {
    const event = await createEvent('2026-03-28T00:00:00.000Z', '2026-03-30T00:00:00.000Z', {
      allDay: true,
      timezone: 'Europe/Berlin',
    });
    expect(event.startAt).toBe('2026-03-28T00:00:00.000Z');
    expect(event.endAt).toBe('2026-03-30T00:00:00.000Z');
  });

  it('rejects wall-clock times for all-day events', async () => {
    const { status, body } = await postEvent({
      id: nextId(),
      calendarId,
      title: 'All-day wall',
      startAt: '2026-03-28T00:00',
      endAt: '2026-03-30T00:00',
      allDay: true,
    });
    expect(status).toBe(422);
    expect(body.errorCode).toBe('EVENT_TIME_INVALID');
  });
});

describe('floating time', () => {
  it('stores floating wall clocks as UTC and returns timezone null (D1)', async () => {
    const event = await createEvent('2026-06-01T09:00', '2026-06-01T10:00');
    expect(event.timezone).toBeNull();
    expect(event.startAt).toBe('2026-06-01T09:00:00.000Z');
  });

  it('accepts explicit null timezone as floating', async () => {
    const event = await createEvent('2026-06-02T22:00', '2026-06-03T02:00', {
      timezone: null,
    });
    expect(event.timezone).toBeNull();
    expect(event.startAt).toBe('2026-06-02T22:00:00.000Z');
    expect(event.endAt).toBe('2026-06-03T02:00:00.000Z');
  });
});

describe('timezone switching (D2/E20)', () => {
  it('keeps the wall clock when switching fixed zones without new times', async () => {
    const event = await createEvent('2026-01-15T09:00', '2026-01-15T10:00', {
      timezone: 'Europe/Berlin', // 08:00Z
    });
    const res = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ timezone: 'Asia/Shanghai' });
    expect(res.status).toBe(200);
    // 09:00 wall clock now in Shanghai (UTC+8)
    expect(res.body.timezone).toBe('Asia/Shanghai');
    expect(res.body.startAt).toBe('2026-01-15T01:00:00.000Z');
    expect(res.body.endAt).toBe('2026-01-15T02:00:00.000Z');
  });

  it('stores the old zone wall clock as UTC when becoming floating', async () => {
    const event = await createEvent('2026-01-15T09:00', '2026-01-15T10:00', {
      timezone: 'Europe/Berlin', // 08:00Z
    });
    const res = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ timezone: null });
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBeNull();
    expect(res.body.startAt).toBe('2026-01-15T09:00:00.000Z');
  });

  it('interprets the UTC wall clock in the new zone when leaving floating', async () => {
    const event = await createEvent('2026-01-15T09:00', '2026-01-15T10:00'); // floating, 09:00Z
    const res = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ timezone: 'Asia/Shanghai' });
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Asia/Shanghai');
    expect(res.body.startAt).toBe('2026-01-15T01:00:00.000Z');
  });

  it('rejects a zone switch that lands in a DST gap (E15 via D2)', async () => {
    const event = await createEvent('2026-03-29T02:30', '2026-03-29T03:30', {
      timezone: null, // floating: 02:30Z..03:30Z
    });
    const res = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ timezone: 'Europe/Berlin' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('EVENT_TIME_INVALID');
  });

  it('recomputes pending reminders when the timezone switch moves the instant (E21)', async () => {
    const event = await createEvent('2026-01-15T09:00', '2026-01-15T10:00', {
      timezone: 'Europe/Berlin', // 08:00Z; day-offset reminder -> 2026-01-14T08:00Z
    });
    const remindersRes = await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({ reminders: [{ offsetDays: 1, preset: 'day' }] });
    expect(remindersRes.status).toBe(200);

    const switchRes = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ timezone: 'Asia/Shanghai' }); // -> 01:00Z
    expect(switchRes.status).toBe(200);

    const listRes = await api(app).get(`/api/calendar/events/${event.id}/reminders`);
    const reminder = (listRes.body as ReminderDto[])[0]!;
    expect(reminder.triggerAt).toBe('2026-01-14T01:00:00.000Z');
    expect(reminder.status).toBe('dismissed'); // trigger already in the past
  });
});

describe('invalid time strings', () => {
  it('rejects garbage datetimes (class-validator 400 before the service)', async () => {
    const { status, body } = await postEvent({
      id: nextId(),
      calendarId,
      title: 'Garbage',
      startAt: 'not-a-date',
      endAt: '2026-01-15T10:00',
    });
    expect(status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });
});
