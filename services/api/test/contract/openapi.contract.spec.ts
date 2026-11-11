import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  api,
  createTestApp,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
  seed,
  waitFor,
} from '../helpers';

const SNAPSHOT_PATH = resolve(__dirname, '../contracts/openapi.snapshot.json');

// A small OpenAPI schema validator (subset: type, required, properties,
// items, nullable, enum, $ref) used to check live responses against the
// schemas declared in the OpenAPI document.
type Schema = Record<string, unknown> & {
  type?: string;
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  nullable?: boolean;
  enum?: unknown[];
  $ref?: string;
};

function validateAgainstSchema(
  value: unknown,
  schema: Schema | undefined,
  schemas: Record<string, Schema>,
  path: string,
): void {
  if (!schema) return;
  if (schema.$ref) {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    const resolved = schemas[refName];
    if (!resolved) throw new Error(`${path}: unresolvable ref ${schema.$ref}`);
    validateAgainstSchema(value, resolved, schemas, path);
    return;
  }
  if (value === null) {
    if (schema.nullable) return;
    throw new Error(`${path}: unexpected null`);
  }
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') throw new Error(`${path}: expected string`);
      if (schema.enum && !schema.enum.includes(value)) {
        throw new Error(`${path}: value ${String(value)} not in enum`);
      }
      break;
    case 'integer':
    case 'number':
      if (typeof value !== 'number') throw new Error(`${path}: expected number`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error(`${path}: expected boolean`);
      break;
    case 'array':
      if (!Array.isArray(value)) throw new Error(`${path}: expected array`);
      for (const [i, item] of value.entries()) {
        validateAgainstSchema(item, schema.items, schemas, `${path}[${i}]`);
      }
      break;
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${path}: expected object`);
      }
      const record = value as Record<string, unknown>;
      for (const requiredKey of schema.required ?? []) {
        if (!(requiredKey in record)) {
          throw new Error(`${path}: missing required property ${requiredKey}`);
        }
      }
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        if (key in record) {
          validateAgainstSchema(record[key], propSchema, schemas, `${path}.${key}`);
        }
      }
      break;
    }
  }
}

interface OpenApiDoc {
  components: { schemas: Record<string, Schema> };
  paths: Record<string, unknown>;
}

describe('OpenAPI contract', () => {
  let app: INestApplication;
  let doc: OpenApiDoc;
  let schemas: Record<string, Schema>;

  beforeAll(async () => {
    migrateDeploy();
    app = await createTestApp();
    await resetDatabase(app);
    await registerTestUser(app, 'contract-tester');
    await seed(app);

    const res = await api(app).get('/api/docs-json');
    expect(res.status).toBe(200);
    doc = res.body as OpenApiDoc;
    schemas = doc.components.schemas;
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  it('serves the OpenAPI JSON document with all main endpoints', () => {
    for (const route of [
      '/api/travel/trips',
      '/api/travel/trips/{id}',
      '/api/travel/trips/{id}/transports',
      '/api/travel/transports/{id}',
      '/api/travel/countries',
      '/api/travel/countries/{id}/cities',
      '/api/travel/cities/{id}/locations',
      '/api/travel/seed',
      '/api/calendar/calendars',
      '/api/calendar/calendars/{id}',
      '/api/calendar/events',
      '/api/calendar/events/{id}',
      '/api/calendar/events/{id}/reminders',
      '/api/calendar/reminders/due',
      '/api/calendar/holidays',
      '/api/calendar/travel-events',
    ]) {
      expect(doc.paths, `missing route ${route}`).toHaveProperty(route);
    }
  });

  it('matches the committed OpenAPI snapshot', () => {
    const serialized = `${JSON.stringify(doc, null, 2)}\n`;
    if (!existsSync(SNAPSHOT_PATH)) {
      writeFileSync(SNAPSHOT_PATH, serialized);
    }
    expect(readFileSync(SNAPSHOT_PATH, 'utf8')).toBe(serialized);
  });

  it('live responses conform to the declared schemas', async () => {
    const countries = await api(app).get('/api/travel/countries');
    validateAgainstSchema(countries.body, { type: 'array', items: schemas.CountryDto }, schemas, '$');

    const germany = (countries.body as { id: string; code: string }[]).find(
      (c) => c.code === 'DE',
    )!;
    const cities = await api(app).get(`/api/travel/countries/${germany.id}/cities`);
    validateAgainstSchema(cities.body, { type: 'array', items: schemas.CityDto }, schemas, '$');

    const berlin = (cities.body as { id: string; name: string }[]).find(
      (c) => c.name === 'Berlin',
    )!;
    const munich = (cities.body as { id: string; name: string }[]).find(
      (c) => c.name === 'Munich',
    )!;
    const locations = await api(app).get(`/api/travel/cities/${berlin.id}/locations`);
    validateAgainstSchema(
      locations.body,
      { type: 'array', items: schemas.LocationDto },
      schemas,
      '$',
    );

    const tripRes = await api(app)
      .post('/api/travel/trips')
      .send({ title: 'Contract trip', type: 'PLAN' });
    validateAgainstSchema(tripRes.body, schemas.TripDto, schemas, '$');

    const transportRes = await api(app)
      .post(`/api/travel/trips/${tripRes.body.id}/transports`)
      .send({
        mode: 'TRAIN',
        origin: { level: 'CITY', id: berlin.id },
        destination: { level: 'CITY', id: munich.id },
        plannedDepartureAt: '2026-12-01T09:30:00Z',
        plannedArrivalAt: '2026-12-01T11:45:00Z',
      });
    validateAgainstSchema(transportRes.body, schemas.TransportDto, schemas, '$');

    const tripGet = await api(app).get(`/api/travel/trips/${tripRes.body.id}`);
    validateAgainstSchema(tripGet.body, schemas.TripDto, schemas, '$');

    await waitFor(
      async () => (await api(app).get('/api/calendar/travel-events')).body.length === 1,
    );
    const events = await api(app).get('/api/calendar/travel-events');
    validateAgainstSchema(
      events.body,
      { type: 'array', items: schemas.CalendarEventDto },
      schemas,
      '$',
    );

    // Error bodies follow the ApiErrorBody contract.
    const err = await api(app).get('/api/travel/trips/missing');
    expect(err.status).toBe(404);
    validateAgainstSchema(
      err.body,
      {
        type: 'object',
        required: ['statusCode', 'message', 'errorCode'],
        properties: {
          statusCode: { type: 'integer' },
          message: { type: 'string' },
          errorCode: { type: 'string' },
        },
      },
      schemas,
      '$',
    );
  });
});
