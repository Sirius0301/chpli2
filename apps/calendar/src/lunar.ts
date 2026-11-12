import { Solar } from 'lunar-javascript';

/**
 * Thin adapter over lunar-javascript (M2 D1). The library extrapolates
 * outside its supported range instead of failing, so the caller only gets
 * results within 1900-01-01..2100-12-31 (D2); other dates return null and
 * the month view degrades silently (E56).
 */

export const LUNAR_RANGE_START = '1900-01-01';
export const LUNAR_RANGE_END = '2100-12-31';

export interface LunarInfo {
  /** Lunar day in Chinese: 初一 … 三十. */
  day: string;
  /** Lunar month name (正月/冬月/腊月…); the adapter surfaces it for 初一. */
  month: string;
  /** Solar-term name (小雪, 立春…) when the day is a 节气, else null. */
  jieQi: string | null;
}

function inRange(key: string): boolean {
  return key >= LUNAR_RANGE_START && key <= LUNAR_RANGE_END;
}

/**
 * Lunar info for a local calendar date (its Y-M-D fields, timezone-free).
 * Returns null outside the supported range.
 */
export function lunarInfoFor(date: Date): LunarInfo | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
  if (!inRange(key)) return null;
  const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
  const day = lunar.getDayInChinese();
  const jieQi = lunar.getJieQi() || null;
  return { day, month: lunar.getMonthInChinese(), jieQi };
}

/**
 * Text shown inside a month cell: on 初一 the month name (正月/冬月/腊月),
 * otherwise the lunar day number (初二 … 三十). The 节气 name is rendered
 * separately by the view (H9: both rows show when they coincide).
 * The library returns bare month stems (正/冬/腊), so 月 is appended here.
 */
export function lunarDayLabel(info: LunarInfo): string {
  return info.day === '初一' ? `${info.month}月` : info.day;
}
