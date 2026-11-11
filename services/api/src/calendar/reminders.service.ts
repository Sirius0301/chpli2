import { Inject, Injectable } from '@nestjs/common';
import type { Reminder } from '@prisma/client';
import type {
  DueReminderDto,
  ReminderDto,
  ReminderInput,
  ReminderPreset,
} from '@chpli2/shared';
import { ERROR_CODES, isReminderOffsetValid } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { notFoundException, unprocessableException } from '../shared/http-error';
import { recomputedReminder } from './calendar-time';

@Injectable()
export class RemindersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listForEvent(userId: string, eventId: string): Promise<ReminderDto[]> {
    await this.requireEvent(userId, eventId);
    const reminders = await this.prisma.reminder.findMany({
      where: { eventId, deletedAt: null },
      orderBy: [{ triggerAt: 'asc' }],
    });
    return reminders.map((r) => this.toDto(r));
  }

  /**
   * Replaces the reminder set of an event wholesale. Offsets outside 1..30
   * days are rejected (E4). Reminders whose trigger time already lies in the
   * past are stored as dismissed and never fire retroactively (E13).
   */
  async replace(userId: string, eventId: string, inputs: ReminderInput[]): Promise<ReminderDto[]> {
    const event = await this.requireEvent(userId, eventId);
    const seen = new Set<string>();
    for (const input of inputs) {
      if (!isReminderOffsetValid(input.offsetDays)) {
        throw unprocessableException(
          ERROR_CODES.REMINDER_OFFSET_INVALID,
          `offsetDays must be between 1 and 30, got ${input.offsetDays}`,
        );
      }
      const key = `${input.offsetDays}:${input.preset}`;
      if (seen.has(key)) {
        throw unprocessableException(
          ERROR_CODES.REMINDER_OFFSET_INVALID,
          `duplicate reminder offset ${input.offsetDays}`,
        );
      }
      seen.add(key);
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.reminder.deleteMany({ where: { eventId } });
      for (const input of inputs) {
        const { triggerAt, status } = recomputedReminder(event.startAt, input.offsetDays, now);
        await tx.reminder.create({
          data: {
            eventId,
            offsetDays: input.offsetDays,
            preset: input.preset,
            status,
            triggerAt,
          },
        });
      }
    });
    return this.listForEvent(userId, eventId);
  }

  /**
   * Pending reminders due before `before` (default: now), ordered by trigger
   * time. Hidden or deleted calendars are excluded; `calendarIds` further
   * restricts the query (the client passes its visible calendars, A4).
   */
  async due(userId: string, before?: string, calendarIds?: string[]): Promise<DueReminderDto[]> {
    let beforeDate = new Date();
    if (before !== undefined && before !== '') {
      const parsed = new Date(before);
      if (Number.isNaN(parsed.getTime())) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'before must be a valid ISO 8601 datetime',
        );
      }
      beforeDate = parsed;
    }
    const owned = await this.prisma.calendar.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((c) => c.id));
    const effectiveIds = calendarIds
      ? calendarIds.filter((id) => ownedSet.has(id))
      : [...ownedSet];
    if (effectiveIds.length === 0) return [];
    const reminders = await this.prisma.reminder.findMany({
      where: {
        deletedAt: null,
        status: 'pending',
        triggerAt: { lte: beforeDate },
        event: {
          deletedAt: null,
          calendar: {
            deletedAt: null,
            hidden: false,
            id: { in: effectiveIds },
          },
        },
      },
      include: { event: { include: { calendar: true } } },
      orderBy: [{ triggerAt: 'asc' }],
    });
    return reminders.map((r) => ({
      ...this.toDto(r),
      event: {
        id: r.event.id,
        title: r.event.title,
        startAt: r.event.startAt.toISOString(),
        allDay: r.event.allDay,
        timezone: r.event.timezone,
        calendarId: r.event.calendarId,
        calendarColor: r.event.calendar.color,
      },
    }));
  }

  private async requireEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null, calendar: { userId } },
    });
    if (!event) {
      throw notFoundException(ERROR_CODES.EVENT_NOT_FOUND, 'event not found');
    }
    return event;
  }

  toDto(reminder: Reminder): ReminderDto {
    return {
      id: reminder.id,
      eventId: reminder.eventId,
      offsetDays: reminder.offsetDays,
      preset: reminder.preset as ReminderPreset,
      status: reminder.status as ReminderDto['status'],
      triggerAt: reminder.triggerAt.toISOString(),
      sentAt: reminder.sentAt?.toISOString() ?? null,
    };
  }
}
