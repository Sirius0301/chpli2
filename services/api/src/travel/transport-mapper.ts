import { Inject, Injectable } from '@nestjs/common';
import type { Transport } from '@prisma/client';
import {
  transportSyncKey,
  type RouteEndpointDto,
  type RouteLevel,
  type TransportDto,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { CalendarSyncStatusService } from '../calendar/calendar-sync-status.service';

const iso = (date: Date | null): string | null =>
  date ? date.toISOString() : null;

interface ResolvedEndpoint {
  name: string;
  cityId?: string;
}

/**
 * Maps Transport rows to TransportDto, resolving endpoint display names and
 * calendar sync state. Endpoint names are resolved in bulk per level.
 */
@Injectable()
export class TransportMapper {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CalendarSyncStatusService)
    private readonly syncStatus: CalendarSyncStatusService,
  ) {}

  async toDtos(transports: Transport[]): Promise<TransportDto[]> {
    const endpoints = await this.resolveEndpoints(transports);
    const syncStates = new Map(
      (
        await this.syncStatus.getBySyncKeys(
          transports.map((t) => transportSyncKey(t.id)),
        )
      ).map((s) => [s.syncKey, s]),
    );

    return transports.map((t) => ({
      id: t.id,
      tripId: t.tripId,
      mode: t.mode as TransportDto['mode'],
      origin: endpoints.get(this.key('origin', t)) as RouteEndpointDto,
      destination: endpoints.get(this.key('destination', t)) as RouteEndpointDto,
      plannedDepartureAt: iso(t.plannedDepartureAt),
      plannedArrivalAt: iso(t.plannedArrivalAt),
      actualDepartureAt: iso(t.actualDepartureAt),
      actualArrivalAt: iso(t.actualArrivalAt),
      calendarSync: syncStates.get(transportSyncKey(t.id)) ?? null,
    }));
  }

  private key(side: 'origin' | 'destination', t: Transport): string {
    return `${side}:${t.id}`;
  }

  private async resolveEndpoints(
    transports: Transport[],
  ): Promise<Map<string, RouteEndpointDto>> {
    const idsByLevel: Record<RouteLevel, Set<string>> = {
      COUNTRY: new Set(),
      CITY: new Set(),
      LOCATION: new Set(),
    };
    for (const t of transports) {
      idsByLevel[t.originLevel as RouteLevel].add(t.originId);
      idsByLevel[t.destinationLevel as RouteLevel].add(t.destinationId);
    }

    const [countries, cities, locations] = await Promise.all([
      idsByLevel.COUNTRY.size
        ? this.prisma.country.findMany({
            where: { id: { in: [...idsByLevel.COUNTRY] } },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      idsByLevel.CITY.size
        ? this.prisma.city.findMany({
            where: { id: { in: [...idsByLevel.CITY] } },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      idsByLevel.LOCATION.size
        ? this.prisma.location.findMany({
            where: { id: { in: [...idsByLevel.LOCATION] } },
          })
        : Promise.resolve([] as { id: string; name: string; cityId: string }[]),
    ]);

    const resolved = new Map<string, ResolvedEndpoint>();
    for (const c of countries) resolved.set(`COUNTRY:${c.id}`, { name: c.name });
    for (const c of cities) resolved.set(`CITY:${c.id}`, { name: c.name });
    for (const l of locations)
      resolved.set(`LOCATION:${l.id}`, { name: l.name, cityId: l.cityId });

    const result = new Map<string, RouteEndpointDto>();
    for (const t of transports) {
      for (const side of ['origin', 'destination'] as const) {
        const level = (side === 'origin' ? t.originLevel : t.destinationLevel) as RouteLevel;
        const id = side === 'origin' ? t.originId : t.destinationId;
        const endpoint = resolved.get(`${level}:${id}`);
        result.set(this.key(side, t), {
          level,
          id,
          // Rows always reference existing endpoints; fall back to the id
          // only as a defensive measure.
          name: endpoint?.name ?? id,
          ...(level === 'LOCATION' && endpoint?.cityId
            ? { cityId: endpoint.cityId }
            : {}),
        });
      }
    }
    return result;
  }
}
