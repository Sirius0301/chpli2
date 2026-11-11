import { describe, expect, it } from 'vitest';
import { buildHolidaySeed, easterSunday } from '../../src/calendar/holiday-data';

function entries(region: string, year: number) {
  return buildHolidaySeed([year]).filter((e) => e.regionCode === region);
}

function dates(region: string, year: number): Map<string, string> {
  return new Map(
    entries(region, year).map((e) => [e.date.toISOString().slice(0, 10), e.nameEn]),
  );
}

describe('easterSunday', () => {
  it('matches known Easter dates', () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
  });
});

describe('DE holidays', () => {
  it('gives every state the nationwide holidays', () => {
    const berlin = dates('DE-BE', 2026);
    expect(berlin.get('2026-01-01')).toBe("New Year's Day");
    expect(berlin.get('2026-04-03')).toBe('Good Friday');
    expect(berlin.get('2026-10-03')).toBe('Day of German Unity');
    expect(berlin.get('2026-12-25')).toBe('Christmas Day');
  });

  it('keeps Epiphany only in BW/BY/ST', () => {
    expect(dates('DE-BY', 2026).get('2026-01-06')).toBe('Epiphany');
    expect(dates('DE-BE', 2026).has('2026-01-06')).toBe(false);
    expect(dates('DE-HH', 2026).has('2026-01-06')).toBe(false);
  });

  it('keeps Fronleichnam only in the Catholic states', () => {
    const easter2026 = '2026-04-05';
    expect(easter2026).toBeTruthy(); // fixed anchor
    // 2026-04-05 + 60 days = 2026-06-04
    expect(dates('DE-NW', 2026).get('2026-06-04')).toBe('Corpus Christi');
    expect(dates('DE-BE', 2026).has('2026-06-04')).toBe(false);
  });

  it('computes Buß- und Bettag as the Wednesday before Nov 23 (SN only)', () => {
    // 2025-11-19 is a Wednesday; 2026-11-18 is a Wednesday.
    expect(dates('DE-SN', 2025).get('2025-11-19')).toBe('Day of Repentance');
    expect(dates('DE-SN', 2026).get('2026-11-18')).toBe('Day of Repentance');
    expect(dates('DE-BY', 2026).has('2026-11-18')).toBe(false);
  });
});

describe('CH holidays', () => {
  it('gives every canton the national holidays', () => {
    const zurich = dates('CH-ZH', 2026);
    expect(zurich.get('2026-01-01')).toBe("New Year's Day");
    expect(zurich.get('2026-08-01')).toBe('Swiss National Day');
    expect(zurich.get('2026-12-25')).toBe('Christmas Day');
  });

  it('keeps Berchtoldstag out of the French- and Italian-speaking cantons', () => {
    expect(dates('CH-ZH', 2026).get('2026-01-02')).toBe("Berchtold's Day");
    expect(dates('CH-GE', 2026).has('2026-01-02')).toBe(false);
    expect(dates('CH-TI', 2026).has('2026-01-02')).toBe(false);
  });
});

describe('CN 2025 holidays', () => {
  const cn = dates('CN', 2025);

  it('covers the official Spring Festival window', () => {
    expect(cn.get('2025-01-28')).toBe('Spring Festival');
    expect(cn.get('2025-02-04')).toBe('Spring Festival');
    expect(cn.has('2025-02-05')).toBe(false);
  });

  it('marks 调休 workdays', () => {
    const workdays = buildHolidaySeed([2025]).filter((e) => e.regionCode === 'CN' && e.isWorkday);
    const workdayDates = workdays.map((e) => e.date.toISOString().slice(0, 10));
    expect(workdayDates).toContain('2025-01-26');
    expect(workdayDates).toContain('2025-04-27');
    expect(workdayDates).toContain('2025-09-28');
    expect(workdayDates).toContain('2025-10-11');
  });

  it('has no CN data outside 2025 yet (E9 silent absence)', () => {
    expect(entries('CN', 2026)).toHaveLength(0);
  });

  it('does not duplicate the National Day / Mid-Autumn overlap', () => {
    const oct6 = buildHolidaySeed([2025]).filter(
      (e) => e.regionCode === 'CN' && e.date.toISOString().slice(0, 10) === '2025-10-06',
    );
    expect(oct6).toHaveLength(1);
  });
});

describe('buildHolidaySeed', () => {
  it('produces a stable, duplicate-free set', () => {
    const a = buildHolidaySeed([2024, 2025]);
    const b = buildHolidaySeed([2024, 2025]);
    expect(a.length).toBeGreaterThan(500);
    expect(a).toEqual(b);
    const keys = a.map((e) => `${e.regionCode}:${e.date.toISOString().slice(0, 10)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
