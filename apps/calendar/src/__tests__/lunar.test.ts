import { describe, expect, it } from 'vitest';
import { lunarDayLabel, lunarInfoFor } from '../lunar';

/**
 * Unit coverage of the lunar adapter (M2 D1/D2/D7): in-range conversion,
 * solar terms, month names on 初一, and silent null outside 1900-2100.
 */

function local(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d);
}

describe('lunarInfoFor', () => {
  it('returns lunar day, month and jieQi for in-range dates', () => {
    // 2026-11-12 is lunar 二〇二六年十月初四 (verified against lunar-javascript).
    const info = lunarInfoFor(local(2026, 11, 12));
    expect(info).not.toBeNull();
    expect(info!.day).toBe('初四');
    expect(info!.month).toBe('十');
    expect(info!.jieQi).toBeNull();

    // 2026-11-22 is 小雪 (minor snow).
    const jieqi = lunarInfoFor(local(2026, 11, 22));
    expect(jieqi!.jieQi).toBe('小雪');
  });

  it('月名 shows on 初一 (lunar first day)', () => {
    // 2026-12-09 is lunar 十一月初一; the library reports the bare stem 冬.
    const info = lunarInfoFor(local(2026, 12, 9));
    expect(info!.day).toBe('初一');
    expect(info!.month).toBe('冬');
    expect(lunarDayLabel(info!)).toBe('冬月');
  });

  it('returns null outside 1900-01-01..2100-12-31 (E56)', () => {
    expect(lunarInfoFor(local(1899, 12, 31))).toBeNull();
    expect(lunarInfoFor(local(2101, 1, 1))).toBeNull();
    expect(lunarInfoFor(local(1900, 1, 1))).not.toBeNull();
    expect(lunarInfoFor(local(2100, 12, 31))).not.toBeNull();
  });
});

describe('lunarDayLabel', () => {
  it('shows the month name on 初一, the day otherwise', () => {
    expect(lunarDayLabel({ day: '初一', month: '冬', jieQi: null })).toBe('冬月');
    expect(lunarDayLabel({ day: '十五', month: '冬', jieQi: null })).toBe('十五');
    expect(lunarDayLabel({ day: '三十', month: '腊', jieQi: null })).toBe('三十');
  });
});
