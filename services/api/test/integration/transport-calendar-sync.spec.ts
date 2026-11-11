import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import type { CalendarEventDto, CityDto, TripDto } from '@chpli2/shared';
import { transportSyncKey } from '@chpli2/shared';
import {
  api,
  createTestApp,
  migrateDeploy,
  resetDatabase,
  seed,
  waitFor,
} from '../helpers';
import { PrismaService } from '../../src/shared/prisma.service';

/**
 * Travel -> Calendar sync over the outbox, exercised through HTTP against a
 * real PostgreSQL database.
 */
describe('Transport -> Calendar sync (integration)', () => {
  let app: INestApplication;
  let berlin: CityDto;
  let munich: CityDto;

  const plannedDeparture = '2026-12-01T09:30:00+01:00';
  const plannedArrival = '2026-12-01T11:45:00+01:00';

  beforeAll(async () => {
    migrateDeploy();
    app = await createTestApp();
    await resetDatabase(app);
    await seed(app);
    const countries = await api(app).get('/api/travel/countries');
    const germany = countries.body.find((c: { code: string }) => c.code === 'DE');
    const cities = await api(app).get(`/api/travel/countries/${germany.id}/cities`);
    berlin = cities.body.find((c: CityDto) => c.name === 'Berlin');
    munich = cities.body.find((c: CityDto) => c.name === 'Munich');
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  async function createTrip(type: 'PLAN' | 'MEMORY', title = 'Test trip'): Promise<TripDto> {
    const res = await api(app).post('/api/travel/trips').send({ title, type });
    expect(res.status).toBe(201);
    return res.body as TripDto;
  }

  async function createTransport(
    tripId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return api(app)
      .post(`/api/travel/trips/${tripId}/transports`)
      .send({
        mode: 'TRAIN',
        origin: { level: 'CITY', id: berlin.id },
        destination: { level: 'CITY', id: munich.id },
        plannedDepartureAt: plannedDeparture,
        plannedArrivalAt: plannedArrival,
        ...overrides,
      });
  }

  async function listEvents(): Promise<CalendarEventDto[]> {
    const res = await api(app).get('/api/calendar/travel-events');
    expect(res.status).toBe(200);
    return res.body as CalendarEventDto[];
  }

  async function eventsFor(transportId: string): Promise<CalendarEventDto[]> {
    return (await listEvents()).filter((e) => e.source.id === transportId);
  }

  it('creates exactly one calendar event for a synced PLAN transport', async () => {
    const trip = await createTrip('PLAN');
    const res = await createTransport(trip.id);
    expect(res.status).toBe(201);
    const transport = res.body;

    await waitFor(async () => (await eventsFor(transport.id)).length === 1);

    const events = await eventsFor(transport.id);
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.source.id).toBe(transport.id);
    expect(event.source.tripId).toBe(trip.id);
    // +01:00 offset is normalized to UTC.
    expect(event.startsAt).toBe('2026-12-01T08:30:00.000Z');
    expect(event.endsAt).toBe('2026-12-01T10:45:00.000Z');
    expect(event.timezone).toBe('UTC');

    // The transport DTO exposes the calendar sync state.
    const tripRes = await api(app).get(`/api/travel/trips/${trip.id}`);
    expect(tripRes.status).toBe(200);
    const sync = tripRes.body.transports[0].calendarSync;
    expect(sync.status).toBe('SYNCED');
    expect(sync.syncKey).toBe(transportSyncKey(transport.id));
    expect(sync.eventId).toBe(event.id);
  });

  it('keeps a single event and updates it when the transport is patched twice', async () => {
    const trip = await createTrip('PLAN');
    const created = await createTransport(trip.id);
    const id = created.body.id as string;
    await waitFor(async () => (await eventsFor(id)).length === 1);

    for (const day of ['2026-12-02', '2026-12-03']) {
      const res = await api(app)
        .patch(`/api/travel/transports/${id}`)
        .send({
          plannedDepartureAt: `${day}T09:30:00+01:00`,
          plannedArrivalAt: `${day}T11:45:00+01:00`,
        });
      expect(res.status).toBe(200);
    }

    await waitFor(async () => {
      const events = await eventsFor(id);
      return (
        events.length === 1 && events[0]!.startsAt === '2026-12-03T08:30:00.000Z'
      );
    });
    const events = await eventsFor(id);
    expect(events).toHaveLength(1);
    expect(events[0]!.endsAt).toBe('2026-12-03T10:45:00.000Z');
  });

  it('never creates calendar events for MEMORY trips', async () => {
    const trip = await createTrip('MEMORY');
    const res = await createTransport(trip.id);
    expect(res.status).toBe(201);

    // Give the dispatcher time; it must not produce any event.
    await new Promise((resolve) => setTimeout(resolve, 700));
    const events = await listEvents();
    expect(events.find((e) => e.source.id === res.body.id)).toBeUndefined();
  });

  it('does not sync PLAN transports with syncToCalendar=false', async () => {
    const trip = await createTrip('PLAN');
    const res = await createTransport(trip.id, { syncToCalendar: false });
    expect(res.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 700));
    const events = await listEvents();
    expect(events.find((e) => e.source.id === res.body.id)).toBeUndefined();
  });

  it('soft-deletes the calendar event when the transport is deleted', async () => {
    const trip = await createTrip('PLAN');
    const created = await createTransport(trip.id);
    const id = created.body.id as string;
    await waitFor(async () => (await eventsFor(id)).length === 1);

    const del = await api(app).delete(`/api/travel/transports/${id}`);
    expect(del.status).toBe(204);

    await waitFor(async () => (await eventsFor(id)).length === 0);
    // The event row still exists in the database, soft-deleted.
    const prisma = app.get(PrismaService);
    const row = await prisma.calendarEvent.findUnique({
      where: { syncKey: transportSyncKey(id) },
    });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();
  });
});
