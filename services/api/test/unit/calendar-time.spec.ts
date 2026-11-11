import { describe, expect, it } from 'vitest';
import {
  allDayRange,
  dayKey,
  eventDayKeys,
  overlapsWindow,
  recomputedReminder,
  utcMidnight,
} from '../../src/calendar/calendar-time';

describe('allDayRange', () => {
  it('anchors a single-day event at UTC midnights with an exclusive end', () => {
    const { startAt, endAt } = allDayRange(utcMidnight(2026, 12, 24), utcMidnight(2026, 12, 24));
    expect(startAt.toISOString()).toBe('2026-12-24T00:00:00.000Z');
    expect(endAt.toISOString()).toBe('2026-12-25T00:00:00.000Z');
  });

  it('spans multi-day events inclusive of the end date', () => {
    const { startAt, endAt } = allDayRange(utcMidnight(2026, 12, 24), utcMidnight(2026, 12, 26));
    expect(dayKey(startAt)).toBe('2026-12-24');
    expect(dayKey(endAt)).toBe('2026-12-27');
  });
});

describe('eventDayKeys (cross-midnight splitting, E5)', () => {
  it('splits a same-day timed event into one key', () => {
    const start = new Date('2026-12-01T09:00:00Z');
    const end = new Date('2026-12-01T10:30:00Z');
    expect(eventDayKeys(start, end)).toEqual(['2026-12-01']);
  });

  it('splits a cross-midnight event into both days', () => {
    const start = new Date('2026-12-01T22:00:00Z');
    const end = new Date('2026-12-02T02:00:00Z');
    expect(eventDayKeys(start, end)).toEqual(['2026-12-01', '2026-12-02']);
  });

  it('treats the exclusive end as not part of the event', () => {
    const start = utcMidnight(2026, 12, 24);
    const end = utcMidnight(2026, 12, 25);
    expect(eventDayKeys(start, end)).toEqual(['2026-12-24']);
  });

  it('splits a multi-day all-day event into every touched day', () => {
    const start = utcMidnight(2026, 12, 24);
    const end = utcMidnight(2026, 12, 27);
    expect(eventDayKeys(start, end)).toEqual([
      '2026-12-24',
      '2026-12-25',
      '2026-12-26',
    ]);
  });
});

describe('overlapsWindow', () => {
  const from = new Date('2026-12-01T00:00:00Z');
  const to = new Date('2026-12-08T00:00:00Z');

  it('includes events fully inside the window', () => {
    expect(
      overlapsWindow(new Date('2026-12-02T10:00:00Z'), new Date('2026-12-02T11:00:00Z'), from, to),
    ).toBe(true);
  });

  it('includes a multi-day event crossing the whole window', () => {
    expect(
      overlapsWindow(new Date('2026-11-20T00:00:00Z'), new Date('2026-12-20T00:00:00Z'), from, to),
    ).toBe(true);
  });

  it('excludes events ending exactly at the window start', () => {
    expect(overlapsWindow(new Date('2026-11-30T00:00:00Z'), from, from, to)).toBe(false);
  });

  it('excludes events starting exactly at the window end', () => {
    expect(overlapsWindow(to, new Date('2026-12-09T00:00:00Z'), from, to)).toBe(false);
  });
});

describe('recomputedReminder (E7/E13)', () => {
  it('fires offsetDays before the event start', () => {
    const { triggerAt, status } = recomputedReminder(
      new Date('2026-12-31T12:00:00Z'),
      7,
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(triggerAt.toISOString()).toBe('2026-12-24T12:00:00.000Z');
    expect(status).toBe('pending');
  });

  it('dismisses reminders whose trigger time already passed', () => {
    const { status } = recomputedReminder(
      new Date('2026-01-02T12:00:00Z'),
      1,
      new Date('2026-01-05T00:00:00Z'),
    );
    expect(status).toBe('dismissed');
  });
});
