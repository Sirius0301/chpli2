import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transportSyncKey } from '@chpli2/shared';
import { CalendarSyncStatusService } from '../../src/calendar/calendar-sync-status.service';

describe('CalendarSyncStatusService', () => {
  it('returns SYNCED state for active events and skips soft-deleted ones', async () => {
    const prisma = {
      calendarEvent: {
        findMany: vi.fn(async () => [
          {
            id: 'event-1',
            syncKey: transportSyncKey('transport-1'),
            updatedAt: new Date('2026-01-02T00:00:00Z'),
            deletedAt: null,
          },
        ]),
      },
    };
    const service = new CalendarSyncStatusService(prisma as unknown as never);

    const result = await service.getBySyncKeys([
      transportSyncKey('transport-1'),
      transportSyncKey('transport-2'),
    ]);

    expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          syncKey: { in: [transportSyncKey('transport-1'), transportSyncKey('transport-2')] },
          deletedAt: null,
        },
      }),
    );
    expect(result).toEqual([
      {
        eventId: 'event-1',
        syncKey: transportSyncKey('transport-1'),
        syncedAt: '2026-01-02T00:00:00.000Z',
        status: 'SYNCED',
      },
    ]);
  });

  it('returns an empty array without querying when no keys are given', async () => {
    const prisma = { calendarEvent: { findMany: vi.fn() } };
    const service = new CalendarSyncStatusService(prisma as unknown as never);
    await expect(service.getBySyncKeys([])).resolves.toEqual([]);
    expect(prisma.calendarEvent.findMany).not.toHaveBeenCalled();
  });
});
