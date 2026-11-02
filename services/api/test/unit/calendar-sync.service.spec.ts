import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  transportSyncKey,
  type TransportEventPayload,
} from '@chpli2/shared';
import { CalendarSyncService } from '../../src/calendar/calendar-sync.service';

function makePayload(overrides: Partial<TransportEventPayload> = {}): TransportEventPayload {
  return {
    transportId: 'transport-1',
    tripId: 'trip-1',
    tripType: 'PLAN',
    title: 'TRAIN: Berlin -> Munich',
    startsAt: '2026-12-01T08:30:00Z',
    endsAt: '2026-12-01T11:45:00Z',
    timezone: 'UTC',
    syncKey: transportSyncKey('transport-1'),
    ...overrides,
  };
}

function makePrismaMock() {
  return {
    calendarEvent: {
      upsert: vi.fn(async (_args: unknown) => ({ id: 'event-1' })),
      updateMany: vi.fn(async (_args: unknown) => ({ count: 1 })),
    },
  };
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

describe('CalendarSyncService', () => {
  let prisma: PrismaMock;
  let service: CalendarSyncService;

  beforeEach(() => {
    prisma = makePrismaMock();
    const dispatcher = { register: vi.fn() };
    service = new CalendarSyncService(
      prisma as unknown as never,
      dispatcher as unknown as never,
    );
  });

  it('registers handlers for all Transport* event types', () => {
    const registered: string[] = [];
    const dispatcher = {
      register: (type: string, _handler: unknown) => registered.push(type),
    };
    const service = new CalendarSyncService(
      prisma as unknown as never,
      dispatcher as never,
    );
    service.onModuleInit();
    expect(registered).toEqual([
      'TransportPlanned',
      'TransportUpdated',
      'TransportDeleted',
    ]);
  });

  it('skips MEMORY trips without touching the calendar', async () => {
    await service.handleUpsert(makePayload({ tripType: 'MEMORY' }));
    expect(prisma.calendarEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.calendarEvent.updateMany).not.toHaveBeenCalled();
  });

  it('upserts by syncKey with planned times as event window', async () => {
    await service.handleUpsert(makePayload());
    expect(prisma.calendarEvent.upsert).toHaveBeenCalledTimes(1);
    const args = prisma.calendarEvent.upsert.mock.calls[0]?.[0] as {
      where: { syncKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.where.syncKey).toBe(transportSyncKey('transport-1'));
    expect(args.create.sourceModule).toBe('travel');
    expect(args.create.sourceType).toBe('transport');
    expect(args.create.sourceId).toBe('transport-1');
    expect((args.create.startsAt as Date).toISOString()).toBe('2026-12-01T08:30:00.000Z');
    expect((args.create.endsAt as Date).toISOString()).toBe('2026-12-01T11:45:00.000Z');
    expect(args.update.deletedAt).toBeNull();
  });

  it('defaults the missing end to the start and vice versa', async () => {
    await service.handleUpsert(makePayload({ endsAt: null }));
    const args = prisma.calendarEvent.upsert.mock.calls[0]?.[0] as {
      create: { startsAt: Date; endsAt: Date };
    };
    expect(args.create.endsAt.getTime()).toBe(args.create.startsAt.getTime());

    prisma.calendarEvent.upsert.mockClear();
    await service.handleUpsert(makePayload({ startsAt: null }));
    const args2 = prisma.calendarEvent.upsert.mock.calls[0]?.[0] as {
      create: { startsAt: Date; endsAt: Date };
    };
    expect(args2.create.startsAt.getTime()).toBe(args2.create.endsAt.getTime());
  });

  it('does not create an event when both times are missing', async () => {
    await service.handleUpsert(makePayload({ startsAt: null, endsAt: null }));
    expect(prisma.calendarEvent.upsert).not.toHaveBeenCalled();
    // Any stale event for the same syncKey must be removed.
    expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncKey: transportSyncKey('transport-1'), deletedAt: null },
      }),
    );
  });

  it('soft-deletes on TransportDeleted by syncKey', async () => {
    await service.handleDelete(makePayload());
    expect(prisma.calendarEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { syncKey: transportSyncKey('transport-1'), deletedAt: null },
      }),
    );
  });

  it('is idempotent under duplicate delivery', async () => {
    const payload = makePayload();
    await service.handleUpsert(payload);
    await service.handleUpsert(payload);
    expect(prisma.calendarEvent.upsert).toHaveBeenCalledTimes(2);
    const [first, second] = prisma.calendarEvent.upsert.mock.calls.map(
      (c) => c[0] as { create: { startsAt: Date; endsAt: Date; title: string } },
    );
    expect(second?.create.startsAt.getTime()).toBe(first?.create.startsAt.getTime());
    expect(second?.create.endsAt.getTime()).toBe(first?.create.endsAt.getTime());
    expect(second?.create.title).toBe(first?.create.title);
  });
});
