import { Inject, Injectable } from '@nestjs/common';
import type { CalendarSyncStateDto } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';

/**
 * Read-only query API exposed to other modules (Travel) so they can report
 * calendar sync state without writing to calendar tables. Soft-deleted
 * events are reported as not synced.
 */
@Injectable()
export class CalendarSyncStatusService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getBySyncKeys(keys: string[]): Promise<CalendarSyncStateDto[]> {
    if (keys.length === 0) return [];
    const events = await this.prisma.calendarEvent.findMany({
      where: { syncKey: { in: keys }, deletedAt: null },
    });
    return events.map((event) => ({
      eventId: event.id,
      syncKey: event.syncKey,
      syncedAt: event.updatedAt.toISOString(),
      status: 'SYNCED' as const,
    }));
  }
}
