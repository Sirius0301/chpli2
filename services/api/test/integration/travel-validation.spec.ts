import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import type { CityDto, CountryDto, LocationDto, TripDto } from '@chpli2/shared';
import {
  api,
  createTestApp,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
  seed,
} from '../helpers';

/** Input validation, route rules and persistence, exercised over HTTP. */
describe('Travel validation and persistence (integration)', () => {
  let app: INestApplication;
  let germany: CountryDto;
  let china: CountryDto;
  let berlin: CityDto;
  let munich: CityDto;
  let berlinLocations: LocationDto[];

  beforeAll(async () => {
    migrateDeploy();
    app = await createTestApp();
    await resetDatabase(app);
    await registerTestUser(app, 'travel-tester');
    await seed(app);

    const countries = (await api(app).get('/api/travel/countries')).body as CountryDto[];
    germany = countries.find((c) => c.code === 'DE')!;
    china = countries.find((c) => c.code === 'CN')!;
    const germanCities = (
      await api(app).get(`/api/travel/countries/${germany.id}/cities`)
    ).body as CityDto[];
    berlin = germanCities.find((c) => c.name === 'Berlin')!;
    munich = germanCities.find((c) => c.name === 'Munich')!;
    berlinLocations = (
      await api(app).get(`/api/travel/cities/${berlin.id}/locations`)
    ).body as LocationDto[];

    const munichLocations = (
      await api(app).get(`/api/travel/cities/${munich.id}/locations`)
    ).body as LocationDto[];

    // Cross-city location pair used by the CITY_MISMATCH test.
    expect(berlinLocations[0]!.cityId).toBe(berlin.id);
    expect(munichLocations[0]!.cityId).toBe(munich.id);
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  async function createTrip(type: 'PLAN' | 'MEMORY' = 'PLAN'): Promise<TripDto> {
    const res = await api(app).post('/api/travel/trips').send({ title: 'T', type });
    expect(res.status).toBe(201);
    return res.body as TripDto;
  }

  it('exposes geo endpoints with the seeded reference data', async () => {
    const countries = (await api(app).get('/api/travel/countries')).body as CountryDto[];
    expect(countries.map((c) => c.code).sort()).toEqual(['CN', 'DE', 'JP']);
    const cities = (
      await api(app).get(`/api/travel/countries/${china.id}/cities`)
    ).body as CityDto[];
    expect(cities.map((c) => c.name).sort()).toEqual(['Beijing', 'Shanghai']);
    expect(berlinLocations.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects country->city routes with ROUTE_LEVEL_MISMATCH', async () => {
    const trip = await createTrip();
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'FLIGHT',
        origin: { level: 'COUNTRY', id: germany.id },
        destination: { level: 'CITY', id: berlin.id },
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'ROUTE_LEVEL_MISMATCH' });
  });

  it('rejects cross-city location routes with ROUTE_CITY_MISMATCH', async () => {
    const trip = await createTrip();
    const munichLocations = (
      await api(app).get(`/api/travel/cities/${munich.id}/locations`)
    ).body as LocationDto[];
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'CAR',
        origin: { level: 'LOCATION', id: berlinLocations[0]!.id },
        destination: { level: 'LOCATION', id: munichLocations[0]!.id },
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'ROUTE_CITY_MISMATCH' });
  });

  it('rejects identical endpoints with ROUTE_SAME_ENDPOINT', async () => {
    const trip = await createTrip();
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'WALK',
        origin: { level: 'CITY', id: berlin.id },
        destination: { level: 'CITY', id: berlin.id },
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'ROUTE_SAME_ENDPOINT' });
  });

  it('rejects planned arrival before departure with TIME_ORDER_INVALID', async () => {
    const trip = await createTrip();
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'TRAIN',
        origin: { level: 'CITY', id: berlin.id },
        destination: { level: 'CITY', id: munich.id },
        plannedDepartureAt: '2026-12-01T11:00:00Z',
        plannedArrivalAt: '2026-12-01T09:00:00Z',
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'TIME_ORDER_INVALID' });
  });

  it('rejects actual arrival before departure with TIME_ORDER_INVALID', async () => {
    const trip = await createTrip();
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'BUS',
        origin: { level: 'CITY', id: berlin.id },
        destination: { level: 'CITY', id: munich.id },
        actualDepartureAt: '2026-11-01T10:00:00Z',
        actualArrivalAt: '2026-11-01T09:00:00Z',
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'TIME_ORDER_INVALID' });
  });

  it('accepts planned times in the past and persists them', async () => {
    const trip = await createTrip();
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'FLIGHT',
        origin: { level: 'COUNTRY', id: germany.id },
        destination: { level: 'COUNTRY', id: china.id },
        plannedDepartureAt: '2019-05-01T08:00:00+02:00',
        plannedArrivalAt: '2019-05-01T22:30:00+08:00',
      });
    expect(res.status).toBe(201);
    expect(res.body.plannedDepartureAt).toBe('2019-05-01T06:00:00.000Z');
    expect(res.body.origin).toMatchObject({ level: 'COUNTRY', name: 'Germany' });
    expect(res.body.destination).toMatchObject({ level: 'COUNTRY', name: 'China' });
  });

  it('accepts same-city location routes and resolves endpoint names', async () => {
    const trip = await createTrip();
    const res = await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'SUBWAY',
        origin: { level: 'LOCATION', id: berlinLocations[0]!.id },
        destination: { level: 'LOCATION', id: berlinLocations[1]!.id },
      });
    expect(res.status).toBe(201);
    expect(res.body.origin.cityId).toBe(berlin.id);
    expect(res.body.origin.name).toBe(berlinLocations[0]!.name);
    expect(res.body.destination.name).toBe(berlinLocations[1]!.name);
  });

  it('returns 404 with TRIP_NOT_FOUND for unknown trips', async () => {
    const res = await api(app).get('/api/travel/trips/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ errorCode: 'TRIP_NOT_FOUND' });
  });

  it('returns 404 with TRANSPORT_NOT_FOUND for unknown transports', async () => {
    const patch = await api(app)
      .patch('/api/travel/transports/does-not-exist')
      .send({ mode: 'BUS' });
    expect(patch.status).toBe(404);
    expect(patch.body).toMatchObject({ errorCode: 'TRANSPORT_NOT_FOUND' });

    const del = await api(app).delete('/api/travel/transports/does-not-exist');
    expect(del.status).toBe(404);
    expect(del.body).toMatchObject({ errorCode: 'TRANSPORT_NOT_FOUND' });
  });

  it('rejects malformed bodies with VALIDATION_ERROR', async () => {
    const res = await api(app)
      .post('/api/travel/trips')
      .send({ title: 'x', type: 'WRONG' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ errorCode: 'VALIDATION_ERROR' });
  });

  it('persists data: a trip reads back identically after creation', async () => {
    const trip = await createTrip('PLAN');
    await api(app)
      .post(`/api/travel/trips/${trip.id}/transports`)
      .send({
        mode: 'TRAIN',
        origin: { level: 'CITY', id: berlin.id },
        destination: { level: 'CITY', id: munich.id },
        plannedDepartureAt: '2026-12-01T09:30:00Z',
        plannedArrivalAt: '2026-12-01T11:45:00Z',
      })
      .expect(201);

    const first = (await api(app).get(`/api/travel/trips/${trip.id}`)).body as TripDto;
    const second = (await api(app).get(`/api/travel/trips/${trip.id}`)).body as TripDto;
    expect(second).toEqual(first);
    expect(second.transports).toHaveLength(1);
    expect(second.transports[0]).toMatchObject({
      tripId: trip.id,
      mode: 'TRAIN',
      plannedDepartureAt: '2026-12-01T09:30:00.000Z',
      plannedArrivalAt: '2026-12-01T11:45:00.000Z',
      origin: { level: 'CITY', id: berlin.id, name: 'Berlin' },
      destination: { level: 'CITY', id: munich.id, name: 'Munich' },
    });
  });
});
