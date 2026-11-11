import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  api,
  createTestApp,
  migrateDeploy,
  resetDatabase,
} from '../helpers';
import { PrismaService } from '../../src/shared/prisma.service';

/**
 * Integration coverage of the Calendar F1+F2 slice: multi-calendar rules
 * (E1/E2/E10/E12), event CRUD (E3/E6/E11/E14), reminders (E4/E7/E8/E13),
 * holiday lookups (E9) and the due-reminder sidebar query (A4).
 */

interface CalendarDto {
  id: string;
  name: string;
  type: 'custom' | 'subscription';
  readonly: boolean;
  isDefault: boolean;
  hidden: boolean;
  regionCode: string | null;
}

interface EventDto {
  id: string;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  updatedAt: string;
}

interface ReminderDto {
  id: string;
  offsetDays: number;
  preset: string;
  status: string;
  triggerAt: string;
}

let app: INestApplication;

async function createCalendar(name: string, extra: Record<string, unknown> = {}): Promise<CalendarDto> {
  const res = await api(app)
    .post('/api/calendar/calendars')
    .send({ name, color: '#0A84FF', type: 'custom', ...extra });
  expect(res.status).toBe(201);
  return res.body as CalendarDto;
}

async function createEvent(
  calendarId: string,
  id: string,
  startAt: string,
  endAt: string,
  extra: Record<string, unknown> = {},
): Promise<EventDto> {
  const res = await api(app)
    .post('/api/calendar/events')
    .send({ id, calendarId, title: 'Test event', startAt, endAt, ...extra });
  expect(res.status).toBe(201);
  return res.body as EventDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('calendars', () => {
  it('a fresh workspace auto-provisions one default calendar; names may repeat', async () => {
    const initial = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    expect(initial).toHaveLength(1);
    expect(initial[0]!.isDefault).toBe(true);
    expect(initial[0]!.type).toBe('custom');

    const a = await createCalendar('Personal');
    const b = await createCalendar('Personal');
    expect(a.isDefault).toBe(false);
    expect(b.isDefault).toBe(false);
    const list = await api(app).get('/api/calendar/calendars');
    expect(list.body).toHaveLength(3);
  });

  it('E2: the last custom calendar cannot be deleted', async () => {
    // Delete all but one calendar.
    const list = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    for (const c of list.slice(1)) {
      const res = await api(app).delete(`/api/calendar/calendars/${c.id}`);
      expect(res.status).toBe(204);
    }
    const last = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    expect(last).toHaveLength(1);
    const res = await api(app).delete(`/api/calendar/calendars/${last[0]!.id}`);
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('LAST_CUSTOM_CALENDAR');
  });

  it('E10: subscription calendars require a known region code', async () => {
    const missing = await api(app)
      .post('/api/calendar/calendars')
      .send({ name: 'CN Holidays', color: '#FF453A', type: 'subscription' });
    expect(missing.status).toBe(422);
    expect(missing.body.errorCode).toBe('HOLIDAY_REGION_REQUIRED');

    const unknown = await api(app)
      .post('/api/calendar/calendars')
      .send({ name: 'XX Holidays', color: '#FF453A', type: 'subscription', regionCode: 'XX-YY' });
    expect(unknown.status).toBe(422);

    const ok = await api(app)
      .post('/api/calendar/calendars')
      .send({ name: 'CN Holidays', color: '#FF453A', type: 'subscription', regionCode: 'CN' });
    expect(ok.status).toBe(201);
    expect(ok.body.readonly).toBe(true);
  });

  it('subscription calendars are read-only (E12 target side)', async () => {
    const sub = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    const cn = sub.find((c) => c.type === 'subscription')!;
    const rename = await api(app).patch(`/api/calendar/calendars/${cn.id}`).send({ name: 'X' });
    expect(rename.status).toBe(422);
    expect(rename.body.errorCode).toBe('CALENDAR_READONLY');
    // Toggling visibility is allowed.
    const hide = await api(app).patch(`/api/calendar/calendars/${cn.id}`).send({ hidden: true });
    expect(hide.status).toBe(200);
    await api(app).patch(`/api/calendar/calendars/${cn.id}`).send({ hidden: false });
  });
});

describe('events', () => {
  it('E3: endAt must be after startAt', async () => {
    const cal = await createCalendar('Work');
    const res = await api(app)
      .post('/api/calendar/events')
      .send({
        id: crypto.randomUUID(),
        calendarId: cal.id,
        title: 'Bad',
        startAt: '2026-12-01T10:00:00Z',
        endAt: '2026-12-01T10:00:00Z',
      });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('EVENT_TIME_INVALID');
  });

  it('E6: all-day events are stored as date-anchored UTC midnights', async () => {
    const cal = await createCalendar('Work');
    const event = await createEvent(
      cal.id,
      crypto.randomUUID(),
      '2026-12-24T00:00:00Z',
      '2026-12-27T00:00:00Z',
      { allDay: true, title: 'Christmas days' },
    );
    expect(event.startAt).toBe('2026-12-24T00:00:00.000Z');
    expect(event.endAt).toBe('2026-12-27T00:00:00.000Z');
    // Non-midnight all-day instants are rejected.
    const bad = await api(app)
      .post('/api/calendar/events')
      .send({
        id: crypto.randomUUID(),
        calendarId: cal.id,
        title: 'Bad all-day',
        startAt: '2026-12-24T09:00:00Z',
        endAt: '2026-12-25T00:00:00Z',
        allDay: true,
      });
    expect(bad.status).toBe(422);
  });

  it('E11: repeated create with the same id returns the original event', async () => {
    const cal = await createCalendar('Work');
    const id = crypto.randomUUID();
    const first = await createEvent(cal.id, id, '2026-12-01T09:00:00Z', '2026-12-01T10:00:00Z', {
      title: 'Original',
    });
    const retry = await api(app)
      .post('/api/calendar/events')
      .send({
        id,
        calendarId: cal.id,
        title: 'Duplicated attempt',
        startAt: '2026-12-02T09:00:00Z',
        endAt: '2026-12-02T10:00:00Z',
      });
    expect(retry.status).toBe(201);
    expect(retry.body.id).toBe(first.id);
    expect(retry.body.title).toBe('Original');
    const list = await api(app).get('/api/calendar/events?from=2026-11-01T00:00:00Z&to=2027-01-01T00:00:00Z');
    expect((list.body as EventDto[]).filter((e) => e.id === id)).toHaveLength(1);
  });

  it('E12: events cannot be created in or moved to a read-only calendar', async () => {
    const sub = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    const cn = sub.find((c) => c.type === 'subscription')!;
    const res = await api(app)
      .post('/api/calendar/events')
      .send({
        id: crypto.randomUUID(),
        calendarId: cn.id,
        title: 'Nope',
        startAt: '2026-12-01T09:00:00Z',
        endAt: '2026-12-01T10:00:00Z',
      });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('CALENDAR_READONLY');
  });

  it('E14: concurrent edits are rejected with 409 and succeed after reload', async () => {
    const cal = await createCalendar('Work');
    const event = await createEvent(cal.id, crypto.randomUUID(), '2026-12-01T09:00:00Z', '2026-12-01T10:00:00Z');
    const stale = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ title: 'Stale write', updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(stale.status).toBe(409);
    expect(stale.body.errorCode).toBe('CONCURRENT_MODIFICATION');

    const fresh = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ title: 'Fresh write', updatedAt: event.updatedAt });
    expect(fresh.status).toBe(200);
    expect(fresh.body.title).toBe('Fresh write');
  });

  it('window queries include multi-day events overlapping the range', async () => {
    const cal = await createCalendar('Work');
    await createEvent(cal.id, crypto.randomUUID(), '2026-11-20T00:00:00Z', '2026-12-10T00:00:00Z', {
      title: 'Long event',
    });
    const res = await api(app).get('/api/calendar/events?from=2026-12-01T00:00:00Z&to=2026-12-02T00:00:00Z');
    const events = res.body as EventDto[];
    expect(events.some((e) => e.title === 'Long event')).toBe(true);
  });
});

describe('E1: deleting a calendar with events', () => {
  it('409 without a target; events move with move_to; deletion is confirmed-safe', async () => {
    const source = await createCalendar('Source');
    const target = await createCalendar('Target');
    await createEvent(source.id, crypto.randomUUID(), '2026-12-01T09:00:00Z', '2026-12-01T10:00:00Z');

    const blocked = await api(app).delete(`/api/calendar/calendars/${source.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.errorCode).toBe('CALENDAR_DELETE_REQUIRES_TARGET');
    // No data changed: calendar and event still there.
    const stillThere = await api(app).get('/api/calendar/calendars');
    expect((stillThere.body as CalendarDto[]).some((c) => c.id === source.id)).toBe(true);

    const done = await api(app).delete(`/api/calendar/calendars/${source.id}?move_to=${target.id}`);
    expect(done.status).toBe(204);
    const list = await api(app).get('/api/calendar/events?from=2026-11-01T00:00:00Z&to=2027-01-01T00:00:00Z');
    const moved = (list.body as EventDto[]).filter((e) => e.calendarId === target.id);
    expect(moved.length).toBeGreaterThanOrEqual(1);
  });

  it('delete_events=true removes the calendar and its events together', async () => {
    const source = await createCalendar('Doomed');
    await createEvent(source.id, crypto.randomUUID(), '2026-12-06T09:00:00Z', '2026-12-06T10:00:00Z');
    const res = await api(app).delete(`/api/calendar/calendars/${source.id}?delete_events=true`);
    expect(res.status).toBe(204);
    const calendars = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    expect(calendars.some((c) => c.id === source.id)).toBe(false);
    const events = await api(app).get(
      `/api/calendar/events?from=2026-12-01T00:00:00Z&to=2026-12-31T00:00:00Z&calendar_ids=${source.id}`,
    );
    expect(events.body).toHaveLength(0);
  });

  it('calendars without events are deleted directly (no target needed)', async () => {
    const empty = await createCalendar('Empty');
    const res = await api(app).delete(`/api/calendar/calendars/${empty.id}`);
    expect(res.status).toBe(204);
    const list = (await api(app).get('/api/calendar/calendars')).body as CalendarDto[];
    expect(list.some((c) => c.id === empty.id)).toBe(false);
  });
});

describe('reminders', () => {
  it('E4: offsets outside 1..30 days are rejected', async () => {
    const cal = await createCalendar('Work');
    const event = await createEvent(cal.id, crypto.randomUUID(), '2027-12-01T09:00:00Z', '2027-12-01T10:00:00Z');
    const tooFar = await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({ reminders: [{ offsetDays: 31, preset: 'custom' }] });
    expect(tooFar.status).toBe(422);
    expect(tooFar.body.errorCode).toBe('REMINDER_OFFSET_INVALID');
    const zero = await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({ reminders: [{ offsetDays: 0, preset: 'custom' }] });
    expect(zero.status).toBe(422);
  });

  it('stores presets and computes triggerAt from the event start', async () => {
    const cal = await createCalendar('Work');
    const event = await createEvent(cal.id, crypto.randomUUID(), '2027-12-31T09:00:00Z', '2027-12-31T10:00:00Z');
    const res = await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({
        reminders: [
          { offsetDays: 30, preset: 'month' },
          { offsetDays: 7, preset: 'week' },
          { offsetDays: 3, preset: 'custom' },
        ],
      });
    expect(res.status).toBe(200);
    const reminders = res.body as ReminderDto[];
    expect(reminders).toHaveLength(3);
    expect(reminders[0]!.triggerAt).toBe('2027-12-01T09:00:00.000Z');
    expect(reminders.every((r) => r.status === 'pending')).toBe(true);
  });

  it('E13: reminders for events whose trigger time already passed are dismissed', async () => {
    const cal = await createCalendar('Work');
    // Event in the past.
    const event = await createEvent(cal.id, crypto.randomUUID(), '2020-01-10T09:00:00Z', '2020-01-10T10:00:00Z');
    const res = await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({ reminders: [{ offsetDays: 1, preset: 'day' }] });
    expect((res.body as ReminderDto[])[0]!.status).toBe('dismissed');
    // And they never appear in the due list.
    const due = await api(app).get('/api/calendar/reminders/due?before=2030-01-01T00:00:00Z');
    expect((due.body as { eventId: string }[]).some((r) => r.eventId === event.id)).toBe(false);
  });

  it('E7: moving the event recomputes pending reminders but keeps sent ones', async () => {
    const cal = await createCalendar('Work');
    const event = await createEvent(cal.id, crypto.randomUUID(), '2027-06-10T09:00:00Z', '2027-06-10T10:00:00Z');
    await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({
        reminders: [
          { offsetDays: 7, preset: 'week' },
          { offsetDays: 1, preset: 'day' },
        ],
      });
    // Simulate the week reminder having fired already.
    await app.get(PrismaService).reminder.updateMany({
      where: { eventId: event.id, offsetDays: 7 },
      data: { status: 'sent', sentAt: new Date(), triggerAt: new Date('2027-06-03T09:00:00Z') },
    });

    const updated = await api(app)
      .patch(`/api/calendar/events/${event.id}`)
      .send({ startAt: '2027-07-20T09:00:00Z', endAt: '2027-07-20T10:00:00Z', updatedAt: event.updatedAt });
    expect(updated.status).toBe(200);

    const reminders = (await api(app).get(`/api/calendar/events/${event.id}/reminders`)).body as ReminderDto[];
    const week = reminders.find((r) => r.offsetDays === 7)!;
    const day = reminders.find((r) => r.offsetDays === 1)!;
    expect(week.status).toBe('sent'); // sent stays untouched (E7)
    expect(week.triggerAt).toBe('2027-06-03T09:00:00.000Z');
    expect(day.triggerAt).toBe('2027-07-19T09:00:00.000Z');
    expect(day.status).toBe('pending');
  });

  it('E8: deleting an event removes its reminders from every list', async () => {
    const cal = await createCalendar('Work');
    const event = await createEvent(cal.id, crypto.randomUUID(), '2027-06-10T09:00:00Z', '2027-06-10T10:00:00Z');
    await api(app)
      .put(`/api/calendar/events/${event.id}/reminders`)
      .send({ reminders: [{ offsetDays: 30, preset: 'month' }] });
    const del = await api(app).delete(`/api/calendar/events/${event.id}`);
    expect(del.status).toBe(204);
    // The event itself is gone, so its reminder list is no longer reachable.
    const list = await api(app).get(`/api/calendar/events/${event.id}/reminders`);
    expect(list.status).toBe(404);
    const due = await api(app).get('/api/calendar/reminders/due?before=2030-01-01T00:00:00Z');
    expect((due.body as { eventId: string }[]).some((r) => r.eventId === event.id)).toBe(false);
  });

  it('A4: hidden calendars are excluded from the due list', async () => {
    const cal = await createCalendar('Visible');
    // triggerAt = startAt - 30d must not already be in the past, so the
    // event lives far enough in the future.
    const future = await createEvent(cal.id, crypto.randomUUID(), '2027-01-20T09:00:00Z', '2027-01-20T10:00:00Z');
    await api(app)
      .put(`/api/calendar/events/${future.id}/reminders`)
      .send({ reminders: [{ offsetDays: 30, preset: 'month' }] });
    const dueBefore = await api(app).get('/api/calendar/reminders/due?before=2026-12-31T00:00:00Z');
    expect((dueBefore.body as { eventId: string }[]).some((r) => r.eventId === future.id)).toBe(true);

    await api(app).patch(`/api/calendar/calendars/${cal.id}`).send({ hidden: true });
    const dueAfter = await api(app).get('/api/calendar/reminders/due?before=2026-12-31T00:00:00Z');
    expect((dueAfter.body as { eventId: string }[]).some((r) => r.eventId === future.id)).toBe(false);
    await api(app).patch(`/api/calendar/calendars/${cal.id}`).send({ hidden: false });
  });
});

describe('holidays (E9)', () => {
  it('returns CN 2025 data with 调休 workdays', async () => {
    const res = await api(app).get('/api/calendar/holidays?region_codes=CN&from=2025-01-01&to=2025-12-31&lang=zh');
    expect(res.status).toBe(200);
    const entries = res.body as { date: string; name: string; isWorkday: boolean }[];
    expect(entries.some((e) => e.date === '2025-01-29' && e.name === '春节')).toBe(true);
    expect(entries.some((e) => e.date === '2025-01-26' && e.isWorkday)).toBe(true);
  });

  it('serves per-state DE data and localizes names', async () => {
    const res = await api(app).get(
      '/api/calendar/holidays?region_codes=DE-BY,DE-BE&from=2026-06-01&to=2026-06-30&lang=de',
    );
    const entries = res.body as { date: string; name: string; regionCode: string }[];
    // Fronleichnam (2026-06-04) exists in BY but not BE.
    expect(entries.some((e) => e.regionCode === 'DE-BY' && e.name === 'Fronleichnam')).toBe(true);
    expect(entries.some((e) => e.regionCode === 'DE-BE')).toBe(false);
  });

  it('silently returns empty data for uncovered years (E9)', async () => {
    const res = await api(app).get('/api/calendar/holidays?region_codes=CN&from=2030-01-01&to=2030-12-31');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
