/** Minimal type surface of lunar-javascript used by CHPLI (M2). */
declare module 'lunar-javascript' {
  export interface Lunar {
    getDayInChinese(): string;
    getMonthInChinese(): string;
    /** Solar-term name when the day is a 节气, otherwise null/''. */
    getJieQi(): string | null;
  }
  export interface Solar {
    getLunar(): Lunar;
  }
  export const Solar: {
    fromYmd(year: number, month: number, day: number): Solar;
  };
}
