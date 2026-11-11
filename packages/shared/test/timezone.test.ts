import { describe, expect, it } from 'vitest';
import {
  floatingWallToUtc,
  isValidTimezone,
  parseEventTime,
  utcToFloatingWall,
  wallClockOf,
  wallClockToInput,
  zonedTimeToUtc,
} from '../src/timezone.js';

describe('isValidTimezone', () => {
  it('accepts IANA names', () => {
    expect(isValidTimezone('Europe/Berlin')).toBe(true);
    expect(isValidTimezone('Asia/Shanghai')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
  });

  it('rejects unknown or malformed names (E19)', () => {
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('Berlin')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(' Europe/Berlin')).toBe(false);
  });
});

describe('zonedTimeToUtc', () => {
  it('resolves a plain offset zone', () => {
    const instant = zonedTimeToUtc(
      { year: 2026, month: 12, day: 1, hour: 9, minute: 30, second: 0 },
      'Asia/Shanghai',
    );
    expect(instant).toEqual(new Date('2026-12-01T01:30:00Z'));
  });

  it('resolves winter time in Berlin (CET, UTC+1)', () => {
    const instant = zonedTimeToUtc(
      { year: 2026, month: 1, day: 15, hour: 9, minute: 0, second: 0 },
      'Europe/Berlin',
    );
    expect(instant).toEqual(new Date('2026-01-15T08:00:00Z'));
  });

  it('resolves summer time in Berlin (CEST, UTC+2)', () => {
    const instant = zonedTimeToUtc(
      { year: 2026, month: 7, day: 15, hour: 9, minute: 0, second: 0 },
      'Europe/Berlin',
    );
    expect(instant).toEqual(new Date('2026-07-15T07:00:00Z'));
  });

  it('returns null for a nonexistent spring-forward time (E15)', () => {
    // 2026-03-29 clocks jump 02:00 -> 03:00 in Berlin
    expect(
      zonedTimeToUtc({ year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 }, 'Europe/Berlin'),
    ).toBeNull();
  });

  it('resolves the moment right at the spring-forward jump', () => {
    expect(
      zonedTimeToUtc({ year: 2026, month: 3, day: 29, hour: 3, minute: 0, second: 0 }, 'Europe/Berlin'),
    ).toEqual(new Date('2026-03-29T01:00:00Z'));
  });

  it('resolves an ambiguous fall-back time to the earlier occurrence (D4)', () => {
    // 2026-10-25 02:30 happens twice in Berlin; expect CEST (UTC+2)
    const instant = zonedTimeToUtc(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 },
      'Europe/Berlin',
    );
    expect(instant).toEqual(new Date('2026-10-25T00:30:00Z'));
  });

  it('is stable across a round trip', () => {
    const wall = { year: 2027, month: 2, day: 28, hour: 23, minute: 59, second: 59 };
    const instant = zonedTimeToUtc(wall, 'Europe/Berlin');
    expect(instant).not.toBeNull();
    expect(wallClockOf(instant!, 'Europe/Berlin')).toEqual(wall);
  });
});

describe('wallClockOf', () => {
  it('expresses an instant in another zone', () => {
    const wall = wallClockOf(new Date('2026-01-15T08:00:00Z'), 'Europe/Berlin');
    expect(wall).toEqual({ year: 2026, month: 1, day: 15, hour: 9, minute: 0, second: 0 });
  });
});

describe('floating time', () => {
  it('stores wall clock as UTC (D1)', () => {
    expect(floatingWallToUtc({ year: 2026, month: 6, day: 1, hour: 9, minute: 0, second: 0 })).toEqual(
      new Date('2026-06-01T09:00:00Z'),
    );
  });

  it('round-trips through utcToFloatingWall (E18)', () => {
    const stored = new Date('2026-06-01T09:00:00Z');
    expect(utcToFloatingWall(stored)).toEqual({
      year: 2026,
      month: 6,
      day: 1,
      hour: 9,
      minute: 0,
      second: 0,
    });
  });
});

describe('parseEventTime', () => {
  it('parses offset strings as instants', () => {
    const parsed = parseEventTime('2026-12-01T09:30:00+08:00');
    expect(parsed).toEqual({ kind: 'instant', instant: new Date('2026-12-01T01:30:00Z') });
  });

  it('parses Z strings as instants', () => {
    const parsed = parseEventTime('2026-12-01T01:30:00.000Z');
    expect(parsed).toEqual({ kind: 'instant', instant: new Date('2026-12-01T01:30:00Z') });
  });

  it('parses offset-less strings as wall clocks', () => {
    const parsed = parseEventTime('2026-03-29T02:30');
    expect(parsed).toEqual({
      kind: 'wall',
      wall: { year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 },
    });
  });

  it('parses wall clocks with seconds', () => {
    const parsed = parseEventTime('2026-03-29T02:30:15');
    expect(parsed).toMatchObject({ kind: 'wall' });
  });

  it('rejects garbage', () => {
    expect(parseEventTime('not-a-date')).toBeNull();
    expect(parseEventTime('2026-13-40T99:99')).toBeNull();
    expect(parseEventTime('')).toBeNull();
  });
});

describe('wallClockToInput', () => {
  it('formats for datetime-local inputs', () => {
    expect(wallClockToInput({ year: 2026, month: 3, day: 5, hour: 9, minute: 5, second: 0 })).toBe(
      '2026-03-05T09:05',
    );
  });
});
