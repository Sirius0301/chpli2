import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { HolidayEntry } from '@prisma/client';
import type { HolidayEntryDto } from '@chpli2/shared';
import { ERROR_CODES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { unprocessableException } from '../shared/http-error';
import { buildHolidaySeed } from './holiday-data';

/** Years of built-in holiday data generated at seed time. */
export const HOLIDAY_SEED_YEARS = [2024, 2025, 2026, 2027, 2028];

export type HolidayLanguage = 'zh' | 'en' | 'de';

@Injectable()
export class HolidaysService implements OnModuleInit {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Idempotent seed: built-in holiday data is inserted once (skip duplicates). */
  async onModuleInit(): Promise<void> {
    const rows = buildHolidaySeed(HOLIDAY_SEED_YEARS);
    const result = await this.prisma.holidayEntry.createMany({
      data: rows.map((r) => ({
        regionCode: r.regionCode,
        date: r.date,
        nameZh: r.nameZh,
        nameEn: r.nameEn,
        nameDe: r.nameDe,
        isWorkday: r.isWorkday,
      })),
      skipDuplicates: true,
    });
    if (result.count > 0) {
      this.logger.log(`seeded ${result.count} holiday entries`);
    }
  }

  /**
   * Read-only holiday lookup for the subscribed regions. Names are localized
   * with zh -> en -> de fallback.
   */
  async list(
    regionCodes: string[],
    from: string,
    to: string,
    lang: string,
  ): Promise<HolidayEntryDto[]> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'from and to must be valid ISO dates',
      );
    }
    const entries = await this.prisma.holidayEntry.findMany({
      where: {
        regionCode: { in: regionCodes },
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ date: 'asc' }, { regionCode: 'asc' }],
    });
    return entries.map((e) => this.toDto(e, lang));
  }

  toDto(entry: HolidayEntry, lang: string): HolidayEntryDto {
    const name =
      (lang === 'zh' && entry.nameZh) ||
      (lang === 'de' && (entry.nameDe || entry.nameEn)) ||
      (entry.nameEn || entry.nameDe || entry.nameZh);
    return {
      id: entry.id,
      regionCode: entry.regionCode,
      date: entry.date.toISOString().slice(0, 10),
      name,
      isWorkday: entry.isWorkday,
    };
  }
}
