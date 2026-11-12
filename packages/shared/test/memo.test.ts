import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  addMonthsToKeyClamped,
  expandMemoToRange,
  isDateKey,
  weekdayOrdinalInMonth,
  type MemoExpansionSource,
} from '../src/memo.js';

function memo(partial: Partial<MemoExpansionSource> & Pick<MemoExpansionSource, 'date'>): MemoExpansionSource {
  return { repeat: 'none', repeatEnd: null, ...partial };
}

describe('isDateKey', () => {
  it('accepts real dates and rejects malformed ones', () => {
    expect(isDateKey('2026-02-28')).toBe(true);
    expect(isDateKey('2024-02-29')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-1')).toBe(false);
    expect(isDateKey('not-a-date')).toBe(false);
  });
});

describe('date-key arithmetic', () => {
  it('addDaysToKey crosses month and year boundaries', () => {
    expect(addDaysToKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('addMonthsToKeyClamped clamps to shorter months', () => {
    expect(addMonthsToKeyClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToKeyClamped('2026-01-31', 3)).toBe('2026-04-30');
    expect(addMonthsToKeyClamped('2024-02-29', 12)).toBe('2025-02-28');
    expect(addMonthsToKeyClamped('2026-05-15', -2)).toBe('2026-03-15');
  });

  it('weekdayOrdinalInMonth counts weekday occurrences', () => {
    // 2026-11-03 is the first Tuesday of November 2026.
    expect(weekdayOrdinalInMonth('2026-11-03')).toBe(1);
    // 2026-11-10 is the second Tuesday.
    expect(weekdayOrdinalInMonth('2026-11-10')).toBe(2);
  });
});

describe('expandMemoToRange', () => {
  it('none: yields only its own date when in range', () => {
    expect(expandMemoToRange(memo({ date: '2026-11-10' }), '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-10',
    ]);
    expect(expandMemoToRange(memo({ date: '2026-10-01' }), '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('daily: fills every day of the range, bounded by the start date', () => {
    const out = expandMemoToRange(memo({ date: '2026-11-05', repeat: 'daily' }), '2026-11-01', '2026-11-08');
    expect(out).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });

  it('weekdays: skips Saturdays and Sundays', () => {
    // 2026-11-06 is a Friday, 2026-11-09 the following Monday.
    const out = expandMemoToRange(
      memo({ date: '2026-11-06', repeat: 'weekdays' }),
      '2026-11-06',
      '2026-11-11',
    );
    expect(out).toEqual(['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11']);
  });

  it('weekly: repeats every 7 days on the same weekday', () => {
    const out = expandMemoToRange(
      memo({ date: '2026-11-04', repeat: 'weekly' }),
      '2026-11-01',
      '2026-11-30',
    );
    expect(out).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25']);
  });

  it('biweekly: repeats every 14 days', () => {
    const out = expandMemoToRange(
      memo({ date: '2026-11-04', repeat: 'biweekly' }),
      '2026-11-01',
      '2026-12-15',
    );
    expect(out).toEqual(['2026-11-04', '2026-11-18', '2026-12-02']);
  });

  it('monthly: same day each month, clamped at short months', () => {
    const out = expandMemoToRange(
      memo({ date: '2026-01-31', repeat: 'monthly' }),
      '2026-01-01',
      '2026-06-30',
    );
    expect(out).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']);
  });

  it('monthlyByWeekday: same ordinal weekday each month', () => {
    // 2026-04-28 is the 4th Tuesday of April 2026.
    const out = expandMemoToRange(
      memo({ date: '2026-04-28', repeat: 'monthlyByWeekday' }),
      '2026-04-01',
      '2026-08-31',
    );
    expect(out).toEqual(['2026-04-28', '2026-05-26', '2026-06-23', '2026-07-28', '2026-08-25']);
  });

  it('monthlyByWeekday: clamps to the last such weekday when the ordinal is absent (M1 H5)', () => {
    // 2026-12-29 is the 5th Tuesday of December 2026; February 2027 has only
    // four Tuesdays, so the instance clamps to 2027-02-23.
    const out = expandMemoToRange(
      memo({ date: '2026-12-29', repeat: 'monthlyByWeekday' }),
      '2026-12-01',
      '2027-03-31',
    );
    expect(out).toEqual(['2026-12-29', '2027-01-26', '2027-02-23', '2027-03-30']);
  });

  it('quarterly / semiannual / yearly step months correctly', () => {
    expect(
      expandMemoToRange(memo({ date: '2026-01-31', repeat: 'quarterly' }), '2026-01-01', '2026-12-31'),
    ).toEqual(['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31']);
    expect(
      expandMemoToRange(memo({ date: '2026-01-31', repeat: 'semiannual' }), '2026-01-01', '2026-12-31'),
    ).toEqual(['2026-01-31', '2026-07-31']);
    expect(
      expandMemoToRange(memo({ date: '2024-02-29', repeat: 'yearly' }), '2024-01-01', '2028-12-31'),
    ).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('repeatEnd truncates the series inclusively', () => {
    const out = expandMemoToRange(
      memo({ date: '2026-11-04', repeat: 'weekly', repeatEnd: '2026-11-11' }),
      '2026-11-01',
      '2026-12-31',
    );
    expect(out).toEqual(['2026-11-04', '2026-11-11']);
  });

  it('repeatEnd before the range yields nothing', () => {
    expect(
      expandMemoToRange(
        memo({ date: '2026-01-01', repeat: 'daily', repeatEnd: '2026-01-05' }),
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual([]);
  });

  it('start date beyond the range start aligns correctly for fixed-step rules', () => {
    expect(expandMemoToRange(memo({ date: '2026-11-02', repeat: 'daily' }), '2026-11-05', '2026-11-06')).toEqual([
      '2026-11-05',
      '2026-11-06',
    ]);
    expect(
      expandMemoToRange(memo({ date: '2026-08-05', repeat: 'monthly' }), '2026-11-01', '2026-11-30'),
    ).toEqual(['2026-11-05']);
  });
});
