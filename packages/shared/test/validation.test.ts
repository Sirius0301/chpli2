import { describe, expect, it } from 'vitest';
import {
  isActualTimeOrderValid,
  isPlannedTimeOrderValid,
  transportSyncKey,
  validateRoute,
} from '../src/validation.js';

describe('validateRoute', () => {
  it('allows country to country', () => {
    expect(
      validateRoute({ level: 'COUNTRY', id: 'c1' }, { level: 'COUNTRY', id: 'c2' }, {}),
    ).toEqual({ ok: true });
  });

  it('allows city to city', () => {
    expect(validateRoute({ level: 'CITY', id: 'a' }, { level: 'CITY', id: 'b' }, {})).toEqual({
      ok: true,
    });
  });

  it('rejects country to city (cross-level)', () => {
    const r = validateRoute({ level: 'COUNTRY', id: 'c1' }, { level: 'CITY', id: 'a' }, {});
    expect(r).toEqual({ ok: false, code: 'ROUTE_LEVEL_MISMATCH' });
  });

  it('rejects city to location (cross-level)', () => {
    const r = validateRoute({ level: 'CITY', id: 'a' }, { level: 'LOCATION', id: 'l1' }, {});
    expect(r).toEqual({ ok: false, code: 'ROUTE_LEVEL_MISMATCH' });
  });

  it('allows locations within the same city', () => {
    const r = validateRoute(
      { level: 'LOCATION', id: 'l1' },
      { level: 'LOCATION', id: 'l2' },
      { originCityId: 'city1', destinationCityId: 'city1' },
    );
    expect(r).toEqual({ ok: true });
  });

  it('rejects locations across different cities', () => {
    const r = validateRoute(
      { level: 'LOCATION', id: 'l1' },
      { level: 'LOCATION', id: 'l2' },
      { originCityId: 'city1', destinationCityId: 'city2' },
    );
    expect(r).toEqual({ ok: false, code: 'ROUTE_CITY_MISMATCH' });
  });

  it('rejects identical endpoints', () => {
    const r = validateRoute({ level: 'CITY', id: 'a' }, { level: 'CITY', id: 'a' }, {});
    expect(r).toEqual({ ok: false, code: 'ROUTE_SAME_ENDPOINT' });
  });
});

describe('time order validation', () => {
  it('accepts missing values (partial entry)', () => {
    expect(isPlannedTimeOrderValid(null, '2026-01-01T00:00:00Z')).toBe(true);
    expect(isPlannedTimeOrderValid('2026-01-01T00:00:00Z', undefined)).toBe(true);
  });

  it('accepts arrival after departure, across offsets', () => {
    expect(
      isPlannedTimeOrderValid('2026-12-01T09:00:00+01:00', '2026-12-01T11:30:00+01:00'),
    ).toBe(true);
    // departure 08:30 UTC, arrival 09:00 UTC written in +01:00 local
    expect(
      isPlannedTimeOrderValid('2026-12-01T09:30:00+01:00', '2026-12-01T10:00:00+01:00'),
    ).toBe(true);
  });

  it('rejects arrival before departure', () => {
    expect(isPlannedTimeOrderValid('2026-12-01T11:00:00Z', '2026-12-01T10:00:00Z')).toBe(false);
  });

  it('validates actual times independently', () => {
    expect(isActualTimeOrderValid('2026-12-01T10:00:00Z', '2026-12-01T09:00:00Z')).toBe(false);
    expect(isActualTimeOrderValid(null, null)).toBe(true);
  });
});

describe('transportSyncKey', () => {
  it('is stable and namespaced', () => {
    expect(transportSyncKey('abc')).toBe('travel:transport:abc');
  });
});
