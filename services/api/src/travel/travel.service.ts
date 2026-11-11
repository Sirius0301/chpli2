import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, Transport, Trip } from '@prisma/client';
import {
  ERROR_CODES,
  isActualTimeOrderValid,
  isPlannedTimeOrderValid,
  transportSyncKey,
  validateRoute,
  type CreateTransportDto,
  type CreateTripDto,
  type RouteEndpointRef,
  type TransportDto,
  type TransportEventPayload,
  type TransportEventType,
  type TripDto,
  type UpdateTransportDto,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { DomainException, notFoundException } from '../shared/http-error';
import { TransportMapper } from './transport-mapper';

const iso = (date: Date | null): string | null =>
  date ? date.toISOString() : null;

function toDate(value: string | null | undefined, field: string): Date | null {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainException(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} must be a valid ISO 8601 datetime`,
    );
  }
  return date;
}

interface ResolvedEndpoint {
  name: string;
  cityId?: string;
}

/**
 * Travel module core service. Owns all writes to travel tables and emits
 * Transport* domain events through the outbox within the same transaction.
 * It never writes calendar tables directly.
 */
@Injectable()
export class TravelService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransportMapper) private readonly mapper: TransportMapper,
  ) {}

  // ------------------------------------------------------------------ trips

  async createTrip(userId: string, dto: CreateTripDto): Promise<TripDto> {
    const trip = await this.prisma.trip.create({
      data: { userId, title: dto.title, type: dto.type },
    });
    return this.toTripDto(trip, []);
  }

  /** Resolves a trip owned by the user; anything else is a 404 (M0 E35). */
  async getTrip(userId: string, id: string): Promise<TripDto> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId },
      include: {
        transports: {
          orderBy: [{ plannedDepartureAt: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!trip) throw notFoundException(ERROR_CODES.TRIP_NOT_FOUND, `trip ${id} not found`);
    const transports = await this.mapper.toDtos(trip.transports);
    return this.toTripDto(trip, transports);
  }

  private async requireTrip(userId: string, tripId: string): Promise<Trip> {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } });
    if (!trip) {
      throw notFoundException(ERROR_CODES.TRIP_NOT_FOUND, `trip ${tripId} not found`);
    }
    return trip;
  }

  // -------------------------------------------------------------- transports

  async createTransport(
    userId: string,
    tripId: string,
    dto: CreateTransportDto,
  ): Promise<TransportDto> {
    const trip = await this.requireTrip(userId, tripId);

    const origin = await this.resolveEndpoint(dto.origin, 'origin');
    const destination = await this.resolveEndpoint(dto.destination, 'destination');
    this.assertRouteValid(dto.origin, dto.destination, origin, destination);
    this.assertTimeOrder(dto);

    const plannedDepartureAt = toDate(dto.plannedDepartureAt, 'plannedDepartureAt');
    const plannedArrivalAt = toDate(dto.plannedArrivalAt, 'plannedArrivalAt');
    const actualDepartureAt = toDate(dto.actualDepartureAt, 'actualDepartureAt');
    const actualArrivalAt = toDate(dto.actualArrivalAt, 'actualArrivalAt');
    const syncToCalendar = dto.syncToCalendar ?? true;

    const transport = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transport.create({
        data: {
          tripId,
          mode: dto.mode,
          originLevel: dto.origin.level,
          originId: dto.origin.id,
          destinationLevel: dto.destination.level,
          destinationId: dto.destination.id,
          plannedDepartureAt,
          plannedArrivalAt,
          actualDepartureAt,
          actualArrivalAt,
          syncToCalendar,
        },
      });
      await this.emitSyncEvent(tx, 'TransportPlanned', trip, created, origin.name, destination.name, syncToCalendar);
      return created;
    });

    return (await this.mapper.toDtos([transport]))[0] as TransportDto;
  }

  async updateTransport(
    userId: string,
    id: string,
    dto: UpdateTransportDto,
  ): Promise<TransportDto> {
    const existing = await this.prisma.transport.findFirst({
      where: { id, trip: { userId } },
      include: { trip: true },
    });
    if (!existing) {
      throw notFoundException(ERROR_CODES.TRANSPORT_NOT_FOUND, `transport ${id} not found`);
    }

    const originRef: RouteEndpointRef = dto.origin ?? {
      level: existing.originLevel as RouteEndpointRef['level'],
      id: existing.originId,
    };
    const destinationRef: RouteEndpointRef = dto.destination ?? {
      level: existing.destinationLevel as RouteEndpointRef['level'],
      id: existing.destinationId,
    };
    const origin = await this.resolveEndpoint(originRef, 'origin');
    const destination = await this.resolveEndpoint(destinationRef, 'destination');
    this.assertRouteValid(originRef, destinationRef, origin, destination);

    const merged = {
      plannedDepartureAt:
        dto.plannedDepartureAt !== undefined
          ? dto.plannedDepartureAt
          : iso(existing.plannedDepartureAt),
      plannedArrivalAt:
        dto.plannedArrivalAt !== undefined
          ? dto.plannedArrivalAt
          : iso(existing.plannedArrivalAt),
      actualDepartureAt:
        dto.actualDepartureAt !== undefined
          ? dto.actualDepartureAt
          : iso(existing.actualDepartureAt),
      actualArrivalAt:
        dto.actualArrivalAt !== undefined
          ? dto.actualArrivalAt
          : iso(existing.actualArrivalAt),
    };
    this.assertTimeOrder(merged);
    const syncToCalendar = dto.syncToCalendar ?? existing.syncToCalendar;

    const transport = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transport.update({
        where: { id },
        data: {
          ...(dto.mode ? { mode: dto.mode } : {}),
          originLevel: originRef.level,
          originId: originRef.id,
          destinationLevel: destinationRef.level,
          destinationId: destinationRef.id,
          plannedDepartureAt: toDate(merged.plannedDepartureAt, 'plannedDepartureAt'),
          plannedArrivalAt: toDate(merged.plannedArrivalAt, 'plannedArrivalAt'),
          actualDepartureAt: toDate(merged.actualDepartureAt, 'actualDepartureAt'),
          actualArrivalAt: toDate(merged.actualArrivalAt, 'actualArrivalAt'),
          syncToCalendar,
        },
      });
      await this.emitSyncEvent(tx, 'TransportUpdated', existing.trip, updated, origin.name, destination.name, syncToCalendar);
      return updated;
    });

    return (await this.mapper.toDtos([transport]))[0] as TransportDto;
  }

  async deleteTransport(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.transport.findFirst({
      where: { id, trip: { userId } },
      include: { trip: true },
    });
    if (!existing) {
      throw notFoundException(ERROR_CODES.TRANSPORT_NOT_FOUND, `transport ${id} not found`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.transport.delete({ where: { id } });
      const dummy = { ...existing, plannedDepartureAt: null, plannedArrivalAt: null };
      await this.emitSyncEvent(tx, 'TransportDeleted', existing.trip, dummy, '', '', false);
    });
  }

  // ----------------------------------------------------------------- helpers

  private async resolveEndpoint(
    ref: RouteEndpointRef,
    which: 'origin' | 'destination',
  ): Promise<ResolvedEndpoint> {
    switch (ref.level) {
      case 'COUNTRY': {
        const country = await this.prisma.country.findUnique({ where: { id: ref.id } });
        if (!country) {
          throw new DomainException(ERROR_CODES.VALIDATION_ERROR, `${which} country not found: ${ref.id}`);
        }
        return { name: country.name };
      }
      case 'CITY': {
        const city = await this.prisma.city.findUnique({ where: { id: ref.id } });
        if (!city) {
          throw new DomainException(ERROR_CODES.VALIDATION_ERROR, `${which} city not found: ${ref.id}`);
        }
        return { name: city.name };
      }
      case 'LOCATION': {
        const location = await this.prisma.location.findUnique({ where: { id: ref.id } });
        if (!location) {
          throw new DomainException(ERROR_CODES.VALIDATION_ERROR, `${which} location not found: ${ref.id}`);
        }
        return { name: location.name, cityId: location.cityId };
      }
    }
  }

  private assertRouteValid(
    origin: RouteEndpointRef,
    destination: RouteEndpointRef,
    resolvedOrigin: ResolvedEndpoint,
    resolvedDestination: ResolvedEndpoint,
  ): void {
    const result = validateRoute(origin, destination, {
      originCityId: resolvedOrigin.cityId,
      destinationCityId: resolvedDestination.cityId,
    });
    if (!result.ok) {
      throw new DomainException(result.code, `invalid route: ${result.code}`);
    }
  }

  private assertTimeOrder(times: {
    plannedDepartureAt?: string | null;
    plannedArrivalAt?: string | null;
    actualDepartureAt?: string | null;
    actualArrivalAt?: string | null;
  }): void {
    if (!isPlannedTimeOrderValid(times.plannedDepartureAt, times.plannedArrivalAt)) {
      throw new DomainException(
        ERROR_CODES.TIME_ORDER_INVALID,
        'plannedArrivalAt must not be before plannedDepartureAt',
      );
    }
    if (!isActualTimeOrderValid(times.actualDepartureAt, times.actualArrivalAt)) {
      throw new DomainException(
        ERROR_CODES.TIME_ORDER_INVALID,
        'actualArrivalAt must not be before actualDepartureAt',
      );
    }
  }

  /**
   * Writes the outbox event that keeps the calendar in sync. Only PLAN trips
   * with syncToCalendar=true publish Planned/Updated events; anything else
   * publishes a Deleted event so an existing calendar event (if any) is
   * removed. MEMORY trips publish nothing.
   */
  private async emitSyncEvent(
    tx: Prisma.TransactionClient,
    type: TransportEventType,
    trip: Trip,
    transport: Transport,
    originName: string,
    destinationName: string,
    syncToCalendar: boolean,
  ): Promise<void> {
    if (trip.type === 'MEMORY') return;
    const payload: TransportEventPayload = {
      transportId: transport.id,
      tripId: trip.id,
      userId: trip.userId,
      tripType: trip.type as TransportEventPayload['tripType'],
      title:
        originName && destinationName
          ? `${transport.mode}: ${originName} -> ${destinationName}`
          : `Transport ${transport.mode}`,
      startsAt: iso(transport.plannedDepartureAt),
      endsAt: iso(transport.plannedArrivalAt),
      timezone: 'UTC',
      syncKey: transportSyncKey(transport.id),
    };
    const eventType: TransportEventType =
      type === 'TransportDeleted' || !syncToCalendar ? 'TransportDeleted' : type;
    await tx.outboxEvent.create({
      data: {
        type: eventType,
        payload: JSON.stringify(payload),
      },
    });
  }

  private toTripDto(trip: Trip, transports: TransportDto[]): TripDto {
    return {
      id: trip.id,
      title: trip.title,
      type: trip.type as TripDto['type'],
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
      transports,
    };
  }
}
