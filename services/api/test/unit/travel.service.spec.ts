import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transport, Trip } from '@prisma/client';
import {
  ERROR_CODES,
  transportSyncKey,
  type TransportEventPayload,
} from '@chpli2/shared';
import { TravelService } from '../../src/travel/travel.service';
import { DomainException } from '../../src/shared/http-error';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    title: 'Trip',
    type: 'PLAN',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeTransport(overrides: Partial<Transport> = {}): Transport {
  return {
    id: 'transport-1',
    tripId: 'trip-1',
    mode: 'TRAIN',
    originLevel: 'COUNTRY',
    originId: 'c1',
    destinationLevel: 'COUNTRY',
    destinationId: 'c2',
    plannedDepartureAt: new Date('2026-12-01T08:30:00Z'),
    plannedArrivalAt: new Date('2026-12-01T11:45:00Z'),
    actualDepartureAt: null,
    actualArrivalAt: null,
    syncToCalendar: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Minimal prisma mock: $transaction runs the callback against itself. */
function makePrismaMock() {
  const prisma = {
    trip: {
      findUnique: vi.fn(),
      create: vi.fn(async (args: { data: { title: string; type: string } }) =>
        makeTrip({ title: args.data.title, type: args.data.type }),
      ),
    },
    country: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id.startsWith('missing')) return null;
        return { id: where.id, name: `Country ${where.id}`, code: where.id.toUpperCase() };
      }),
    },
    city: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id.startsWith('missing')) return null;
        // city ids encode their country for test readability: "cityA:cn"
        return { id: where.id, name: `City ${where.id}`, countryId: 'c1' };
      }),
    },
    location: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id.startsWith('missing')) return null;
        // location ids encode their city: "locA:cityA"
        const cityId = where.id.split(':')[1] ?? 'cityA';
        return { id: where.id, name: `Location ${where.id}`, cityId };
      }),
    },
    transport: {
      findUnique: vi.fn(),
      create: vi.fn(async () => makeTransport()),
      update: vi.fn(async () => makeTransport()),
      delete: vi.fn(async () => makeTransport()),
    },
    outboxEvent: {
      create: vi.fn(async (_args: unknown) => ({ id: 'evt-1' })),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  return prisma;
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

function makeService(prisma: PrismaMock) {
  const mapper = {
    toDtos: vi.fn(async (transports: Transport[]) =>
      transports.map((t) => ({
        id: t.id,
        tripId: t.tripId,
        mode: t.mode,
        origin: { level: t.originLevel, id: t.originId, name: t.originId },
        destination: {
          level: t.destinationLevel,
          id: t.destinationId,
          name: t.destinationId,
        },
        plannedDepartureAt: t.plannedDepartureAt?.toISOString() ?? null,
        plannedArrivalAt: t.plannedArrivalAt?.toISOString() ?? null,
        actualDepartureAt: t.actualDepartureAt?.toISOString() ?? null,
        actualArrivalAt: t.actualArrivalAt?.toISOString() ?? null,
        calendarSync: null,
      }))),
  };
  const service = new TravelService(
    prisma as unknown as never,
    mapper as unknown as never,
  );
  return { service, mapper };
}

const baseDto = {
  mode: 'TRAIN' as const,
  origin: { level: 'COUNTRY' as const, id: 'c1' },
  destination: { level: 'COUNTRY' as const, id: 'c2' },
  plannedDepartureAt: '2026-12-01T08:30:00Z',
  plannedArrivalAt: '2026-12-01T11:45:00Z',
};

describe('TravelService route validation', () => {
  let prisma: PrismaMock;
  let service: TravelService;

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    ({ service } = makeService(prisma));
  });

  it('rejects cross-level routes with ROUTE_LEVEL_MISMATCH', async () => {
    await expect(
      service.createTransport('trip-1', {
        ...baseDto,
        origin: { level: 'COUNTRY', id: 'c1' },
        destination: { level: 'CITY', id: 'cityA' },
      }),
    ).rejects.toMatchObject({
      constructor: DomainException,
      errorCode: ERROR_CODES.ROUTE_LEVEL_MISMATCH,
    });
    expect(prisma.transport.create).not.toHaveBeenCalled();
  });

  it('rejects identical endpoints with ROUTE_SAME_ENDPOINT', async () => {
    await expect(
      service.createTransport('trip-1', {
        ...baseDto,
        destination: { level: 'COUNTRY', id: 'c1' },
      }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.ROUTE_SAME_ENDPOINT });
  });

  it('rejects cross-city locations with ROUTE_CITY_MISMATCH', async () => {
    await expect(
      service.createTransport('trip-1', {
        ...baseDto,
        origin: { level: 'LOCATION', id: 'locA:cityA' },
        destination: { level: 'LOCATION', id: 'locB:cityB' },
      }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.ROUTE_CITY_MISMATCH });
  });

  it('accepts locations within the same city', async () => {
    await service.createTransport('trip-1', {
      ...baseDto,
      origin: { level: 'LOCATION', id: 'locA:cityA' },
      destination: { level: 'LOCATION', id: 'locB:cityA' },
    });
    expect(prisma.transport.create).toHaveBeenCalledTimes(1);
  });

  it('rejects when an endpoint does not exist', async () => {
    await expect(
      service.createTransport('trip-1', {
        ...baseDto,
        destination: { level: 'COUNTRY', id: 'missing-1' },
      }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.VALIDATION_ERROR });
  });
});

describe('TravelService time order validation', () => {
  let prisma: PrismaMock;
  let service: TravelService;

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    ({ service } = makeService(prisma));
  });

  it('rejects planned arrival before departure', async () => {
    await expect(
      service.createTransport('trip-1', {
        ...baseDto,
        plannedDepartureAt: '2026-12-01T11:45:00Z',
        plannedArrivalAt: '2026-12-01T08:30:00Z',
      }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.TIME_ORDER_INVALID });
  });

  it('rejects actual arrival before departure', async () => {
    await expect(
      service.createTransport('trip-1', {
        ...baseDto,
        actualDepartureAt: '2026-12-02T10:00:00Z',
        actualArrivalAt: '2026-12-02T09:00:00Z',
      }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.TIME_ORDER_INVALID });
  });

  it('allows partial time entry', async () => {
    await service.createTransport('trip-1', { ...baseDto, plannedArrivalAt: null });
    expect(prisma.transport.create).toHaveBeenCalledTimes(1);
  });
});

describe('TravelService outbox emission', () => {
  let prisma: PrismaMock;
  let service: TravelService;

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    ({ service } = makeService(prisma));
  });

  function emittedEvent() {
    const call = prisma.outboxEvent.create.mock.calls[0]?.[0] as
      | { data: { type: string; payload: string } }
      | undefined;
    return call
      ? { type: call.data.type, payload: JSON.parse(call.data.payload) as TransportEventPayload }
      : undefined;
  }

  it('writes business row and outbox event in one transaction', async () => {
    await service.createTransport('trip-1', baseDto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const event = emittedEvent();
    expect(event?.type).toBe('TransportPlanned');
    expect(event?.payload.syncKey).toBe(transportSyncKey('transport-1'));
    expect(event?.payload.startsAt).toBe('2026-12-01T08:30:00.000Z');
    expect(event?.payload.endsAt).toBe('2026-12-01T11:45:00.000Z');
    expect(event?.payload.tripType).toBe('PLAN');
  });

  it('emits nothing for MEMORY trips', async () => {
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ type: 'MEMORY' }));
    await service.createTransport('trip-1', baseDto);
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('emits TransportDeleted for PLAN trips with syncToCalendar=false', async () => {
    await service.createTransport('trip-1', { ...baseDto, syncToCalendar: false });
    const event = emittedEvent();
    expect(event?.type).toBe('TransportDeleted');
    expect(event?.payload.syncKey).toBe(transportSyncKey('transport-1'));
  });

  it('throws TRIP_NOT_FOUND for unknown trips', async () => {
    prisma.trip.findUnique.mockResolvedValue(null);
    await expect(service.createTransport('nope', baseDto)).rejects.toMatchObject({
      status: 404,
      errorCode: ERROR_CODES.TRIP_NOT_FOUND,
    });
  });

  it('throws TRANSPORT_NOT_FOUND when updating unknown transport', async () => {
    prisma.transport.findUnique.mockResolvedValue(null);
    await expect(
      service.updateTransport('nope', { mode: 'BUS' }),
    ).rejects.toMatchObject({
      status: 404,
      errorCode: ERROR_CODES.TRANSPORT_NOT_FOUND,
    });
  });
});
