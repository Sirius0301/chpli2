import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { TransportEventPayload } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { OutboxDispatcher } from '../shared/outbox-dispatcher';

/**
 * Consumes Transport* outbox events and mirrors them into CalendarEvent rows
 * keyed by the transport's stable syncKey. All operations are idempotent:
 * re-delivering the same event yields the same database state.
 */
@Injectable()
export class CalendarSyncService implements OnModuleInit {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxDispatcher) private readonly dispatcher: OutboxDispatcher,
  ) {}

  onModuleInit(): void {
    const upsert = (payload: unknown) => this.handleUpsert(payload as TransportEventPayload);
    this.dispatcher.register('TransportPlanned', upsert);
    this.dispatcher.register('TransportUpdated', upsert);
    this.dispatcher.register('TransportDeleted', (payload: unknown) =>
      this.handleDelete(payload as TransportEventPayload),
    );
  }

  async handleUpsert(payload: TransportEventPayload): Promise<void> {
    // MEMORY trips never sync to the calendar.
    if (payload.tripType === 'MEMORY') return;
    // A transport without any planned time has nothing to show; make sure no
    // stale event lingers (idempotent no-op when nothing exists).
    if (payload.startsAt == null && payload.endsAt == null) {
      await this.softDeleteBySyncKey(payload.syncKey);
      return;
    }
    const startsAt =
      payload.startsAt != null ? new Date(payload.startsAt) : new Date(payload.endsAt as string);
    const endsAt =
      payload.endsAt != null ? new Date(payload.endsAt) : startsAt;

    await this.prisma.calendarEvent.upsert({
      where: { syncKey: payload.syncKey },
      create: {
        userId: payload.userId,
        title: payload.title,
        startsAt,
        endsAt,
        timezone: payload.timezone || 'UTC',
        sourceModule: 'travel',
        sourceType: 'transport',
        sourceId: payload.transportId,
        syncKey: payload.syncKey,
      },
      update: {
        title: payload.title,
        startsAt,
        endsAt,
        // Restore the event if it was previously soft-deleted.
        deletedAt: null,
      },
    });
  }

  async handleDelete(payload: TransportEventPayload): Promise<void> {
    await this.softDeleteBySyncKey(payload.syncKey);
  }

  private async softDeleteBySyncKey(syncKey: string): Promise<void> {
    await this.prisma.calendarEvent.updateMany({
      where: { syncKey, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
