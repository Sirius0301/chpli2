import { Inject, Injectable } from '@nestjs/common';
import type { CalendarEvent } from '@prisma/client';
import type { CalendarEventDto } from '@chpli2/shared';
import { ERROR_CODES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { DomainException } from '../shared/http-error';

function parseRange(value: string | undefined, field: string): Date | null {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainException(ERROR_CODES.VALIDATION_ERROR, `${field} must be a valid ISO 8601 datetime`);
  }
  return date;
}

/**
 * Read-only view of the travel-synced projection rows (CalendarEvent).
 * Travel owns the sync writes; this service only reads for display.
 */
@Injectable()
export class TravelEventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Lists the user's active (not soft-deleted) synced events, ordered by startsAt. */
  async list(userId: string, from?: string, to?: string): Promise<CalendarEventDto[]> {
    const fromDate = parseRange(from, 'from');
    const toDate = parseRange(to, 'to');
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(fromDate || toDate
          ? {
              startsAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
    return this.toDtos(events);
  }

  private async toDtos(events: CalendarEvent[]): Promise<CalendarEventDto[]> {
    // Read-only cross-module lookup to enrich the DTO with tripId. The
    // calendar module never writes travel tables.
    const transportIds = [
      ...new Set(
        events
          .filter((e) => e.sourceModule === 'travel' && e.sourceType === 'transport')
          .map((e) => e.sourceId),
      ),
    ];
    const transports = transportIds.length
      ? await this.prisma.transport.findMany({
          where: { id: { in: transportIds } },
          select: { id: true, tripId: true },
        })
      : [];
    const tripIdByTransportId = new Map(transports.map((t) => [t.id, t.tripId]));

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: event.timezone,
      source: {
        module: 'travel',
        type: 'transport',
        id: event.sourceId,
        tripId: tripIdByTransportId.get(event.sourceId) ?? '',
      },
    }));
  }
}
