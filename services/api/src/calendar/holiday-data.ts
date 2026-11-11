/**
 * Built-in holiday reference data for the subscription calendars.
 *
 * - CN: official 2025 arrangement (including 调休 moved workdays). Other years
 *   are intentionally absent until an official data-update mechanism exists
 *   (roadmap 待决策项); views degrade silently per E9.
 * - DE: computed per federal state (fixed + Easter-based holidays).
 * - CH: computed per canton from a canton -> holiday-set mapping. This is
 *   reference data covering the main cantonal observances; edge observances
 *   of individual cantons may be missing until the data source is decided.
 *
 * Everything is deterministic so seeding is idempotent.
 */

export interface HolidaySeed {
  regionCode: string;
  /** UTC midnight of the holiday date. */
  date: Date;
  nameZh: string;
  nameEn: string;
  nameDe: string;
  isWorkday: boolean;
}

interface Localized {
  zh: string;
  en: string;
  de: string;
}

const H = {
  neujahr: { zh: '元旦', en: "New Year's Day", de: 'Neujahr' },
  epiphany: { zh: '主显节', en: 'Epiphany', de: 'Heilige Drei Könige' },
  frauentag: { zh: '国际妇女节', en: "Women's Day", de: 'Frauentag' },
  karfreitag: { zh: '耶稣受难日', en: 'Good Friday', de: 'Karfreitag' },
  ostermontag: { zh: '复活节星期一', en: 'Easter Monday', de: 'Ostermontag' },
  tagDerArbeit: { zh: '劳动节', en: 'Labour Day', de: 'Tag der Arbeit' },
  himmelfahrt: { zh: '耶稣升天日', en: 'Ascension Day', de: 'Christi Himmelfahrt' },
  pfingstmontag: { zh: '圣灵降临节星期一', en: 'Whit Monday', de: 'Pfingstmontag' },
  fronleichnam: { zh: '圣体节', en: 'Corpus Christi', de: 'Fronleichnam' },
  mariaHimmelfahrt: { zh: '圣母升天节', en: 'Assumption of Mary', de: 'Mariä Himmelfahrt' },
  weltkindertag: { zh: '世界儿童节', en: "World Children's Day", de: 'Weltkindertag' },
  tagDerEinheit: { zh: '德国统一日', en: 'Day of German Unity', de: 'Tag der Deutschen Einheit' },
  reformationstag: { zh: '宗教改革日', en: 'Reformation Day', de: 'Reformationstag' },
  allerheiligen: { zh: '万圣节', en: "All Saints' Day", de: 'Allerheiligen' },
  bussUndBettag: { zh: '忏悔与祈祷日', en: 'Day of Repentance', de: 'Buß- und Bettag' },
  weihnachten1: { zh: '圣诞节', en: 'Christmas Day', de: '1. Weihnachtstag' },
  weihnachten2: { zh: '节礼日', en: 'Boxing Day', de: '2. Weihnachtstag' },
  berchtoldstag: { zh: '贝希托尔茨日', en: "Berchtold's Day", de: 'Berchtoldstag' },
  bundesfeier: { zh: '瑞士国庆节', en: 'Swiss National Day', de: 'Bundesfeier' },
  mariaEmpfaengnis: { zh: '圣母无染原罪日', en: 'Immaculate Conception', de: 'Mariä Empfängnis' },
  stephanstag: { zh: '圣斯蒂芬日', en: "St. Stephen's Day", de: 'Stephanstag' },
  cnYuanDan: { zh: '元旦', en: "New Year's Day", de: 'Neujahr' },
  cnChunJie: { zh: '春节', en: 'Spring Festival', de: 'Chinesisches Neujahr' },
  cnQingMing: { zh: '清明节', en: 'Qingming Festival', de: 'Qingming-Fest' },
  cnLaoDong: { zh: '劳动节', en: 'Labour Day', de: 'Tag der Arbeit' },
  cnDuanWu: { zh: '端午节', en: 'Dragon Boat Festival', de: 'Drachenbootfest' },
  cnZhongQiu: { zh: '中秋节', en: 'Mid-Autumn Festival', de: 'Mondfest' },
  cnGuoQing: { zh: '国庆节', en: 'National Day', de: 'Nationalfeiertag' },
  cnDiaoXiu: { zh: '调休工作日', en: 'Adjusted workday', de: 'Verschobener Arbeitstag' },
} satisfies Record<string, Localized>;

const DAY_MS = 24 * 60 * 60 * 1000;

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Easter Sunday (Anonymous Gregorian algorithm), UTC midnight. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

const DE_STATES = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
];

// Declarative DE rules evaluated per year.
const DE_RULES: {
  key: keyof typeof H;
  states: string[];
  /** Offset in days from Easter Sunday, or a fixed month/day. */
  easterOffset?: number;
  fixed?: { m: number; d: number };
  /** Compute from the year (e.g. Buß- und Bettag: Wednesday before Nov 23). */
  compute?: (year: number) => Date;
}[] = [
  { key: 'neujahr', states: DE_STATES, fixed: { m: 1, d: 1 } },
  { key: 'epiphany', states: ['BW', 'BY', 'ST'], fixed: { m: 1, d: 6 } },
  { key: 'frauentag', states: ['BE', 'MV'], fixed: { m: 3, d: 8 } },
  { key: 'karfreitag', states: DE_STATES, easterOffset: -2 },
  { key: 'ostermontag', states: DE_STATES, easterOffset: 1 },
  { key: 'tagDerArbeit', states: DE_STATES, fixed: { m: 5, d: 1 } },
  { key: 'himmelfahrt', states: DE_STATES, easterOffset: 39 },
  { key: 'pfingstmontag', states: DE_STATES, easterOffset: 50 },
  { key: 'fronleichnam', states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'], easterOffset: 60 },
  { key: 'mariaHimmelfahrt', states: ['BY', 'SL'], fixed: { m: 8, d: 15 } },
  { key: 'weltkindertag', states: ['TH'], fixed: { m: 9, d: 20 } },
  { key: 'tagDerEinheit', states: DE_STATES, fixed: { m: 10, d: 3 } },
  { key: 'reformationstag', states: ['BB', 'MV', 'SN', 'ST', 'TH'], fixed: { m: 10, d: 31 } },
  { key: 'allerheiligen', states: ['BW', 'BY', 'NW', 'RP', 'SL'], fixed: { m: 11, d: 1 } },
  {
    key: 'bussUndBettag',
    states: ['SN'],
    // Wednesday before November 23 (strictly before; if Nov 23 is a
    // Wednesday, the previous Wednesday is meant).
    compute: (year) => {
      const nov23 = utc(year, 11, 23);
      let back = (nov23.getUTCDay() - 3 + 7) % 7;
      if (back === 0) back = 7;
      return addDays(nov23, -back);
    },
  },
  { key: 'weihnachten1', states: DE_STATES, fixed: { m: 12, d: 25 } },
  { key: 'weihnachten2', states: DE_STATES, fixed: { m: 12, d: 26 } },
];

const CH_CANTONS = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI',
  'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU',
];

// Main cantonal observances (reference set, see file header).
const CH_KARFREITAG = ['ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG'];
const CH_TAG_DER_ARBEIT = [...CH_KARFREITAG, 'NE', 'JU'];
const CH_STEPHANSTAG = ['ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'NE', 'GE', 'JU'];
const CH_MARIA_HIMMELFAHRT = ['LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'AI', 'AR', 'GR'];
const CH_ALLERHEILIGEN = ['LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'AI', 'AR'];
const CH_MARIA_EMPFAENGNIS = ['LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'AI', 'AR', 'GR', 'AG'];

const CH_RULES: {
  key: keyof typeof H;
  cantons: string[];
  easterOffset?: number;
  fixed?: { m: number; d: number };
}[] = [
  { key: 'neujahr', cantons: CH_CANTONS, fixed: { m: 1, d: 1 } },
  { key: 'berchtoldstag', cantons: CH_KARFREITAG, fixed: { m: 1, d: 2 } },
  { key: 'karfreitag', cantons: CH_KARFREITAG, easterOffset: -2 },
  { key: 'ostermontag', cantons: CH_KARFREITAG, easterOffset: 1 },
  { key: 'tagDerArbeit', cantons: CH_TAG_DER_ARBEIT, fixed: { m: 5, d: 1 } },
  { key: 'himmelfahrt', cantons: CH_KARFREITAG, easterOffset: 39 },
  { key: 'pfingstmontag', cantons: CH_KARFREITAG, easterOffset: 50 },
  { key: 'mariaHimmelfahrt', cantons: CH_MARIA_HIMMELFAHRT, fixed: { m: 8, d: 15 } },
  { key: 'bundesfeier', cantons: CH_CANTONS, fixed: { m: 8, d: 1 } },
  { key: 'allerheiligen', cantons: CH_ALLERHEILIGEN, fixed: { m: 11, d: 1 } },
  { key: 'mariaEmpfaengnis', cantons: CH_MARIA_EMPFAENGNIS, fixed: { m: 12, d: 8 } },
  { key: 'weihnachten1', cantons: CH_CANTONS, fixed: { m: 12, d: 25 } },
  { key: 'stephanstag', cantons: CH_STEPHANSTAG, fixed: { m: 12, d: 26 } },
];

/** Official CN 2025 holiday arrangement (holidays + 调休 workdays). */
const CN_2025: {
  key: keyof typeof H;
  from: [number, number, number];
  to?: [number, number, number];
  workday?: boolean;
}[] = [
  { key: 'cnYuanDan', from: [2025, 1, 1] },
  { key: 'cnChunJie', from: [2025, 1, 28], to: [2025, 2, 4] },
  { key: 'cnDiaoXiu', from: [2025, 1, 26], workday: true },
  { key: 'cnDiaoXiu', from: [2025, 2, 8], workday: true },
  { key: 'cnQingMing', from: [2025, 4, 4], to: [2025, 4, 6] },
  { key: 'cnLaoDong', from: [2025, 5, 1], to: [2025, 5, 5] },
  { key: 'cnDiaoXiu', from: [2025, 4, 27], workday: true },
  { key: 'cnDuanWu', from: [2025, 5, 31], to: [2025, 6, 2] },
  { key: 'cnGuoQing', from: [2025, 10, 1], to: [2025, 10, 8] },
  { key: 'cnDiaoXiu', from: [2025, 9, 28], workday: true },
  { key: 'cnDiaoXiu', from: [2025, 10, 11], workday: true },
];

/**
 * Builds the full deterministic seed set for the given years. When several
 * observances fall on the same date in a region, the first one wins (e.g.
 * CN National Day already covers Oct 6, so Mid-Autumn is folded into it).
 */
export function buildHolidaySeed(years: number[]): HolidaySeed[] {
  const out: HolidaySeed[] = [];
  const seen = new Set<string>();
  const push = (regionCode: string, date: Date, name: Localized, isWorkday = false) => {
    const key = `${regionCode}:${date.toISOString().slice(0, 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ regionCode, date, nameZh: name.zh, nameEn: name.en, nameDe: name.de, isWorkday });
  };

  for (const year of years) {
    const easter = easterSunday(year);
    for (const rule of DE_RULES) {
      const date = rule.fixed
        ? utc(year, rule.fixed.m, rule.fixed.d)
        : rule.compute
          ? rule.compute(year)
          : addDays(easter, rule.easterOffset ?? 0);
      for (const state of rule.states) {
        push(`DE-${state}`, date, H[rule.key]);
      }
    }
    for (const rule of CH_RULES) {
      const date = rule.fixed
        ? utc(year, rule.fixed.m, rule.fixed.d)
        : addDays(easter, rule.easterOffset ?? 0);
      for (const canton of rule.cantons) {
        push(`CH-${canton}`, date, H[rule.key]);
      }
    }
  }
  for (const entry of CN_2025) {
    if (!years.includes(entry.from[0])) continue;
    const from = utc(...entry.from);
    const to = entry.to ? utc(...entry.to) : from;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      push('CN', d, H[entry.key], entry.workday ?? false);
    }
  }
  return out;
}
