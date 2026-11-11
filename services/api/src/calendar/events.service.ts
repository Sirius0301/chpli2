import { Inject, Injectable } from '@nestjs/common';
import type { Event } from '@prisma/client';
import type { CreateEventDto, EventDto, UpdateEventDto } from '@chpli2/shared';
import {
  ERROR_CODES,
  floatingWallToUtc,
  isValidTimezone,
  parseEventTime,
  utcToFloatingWall,
  wallClockOf,
  zonedTimeToUtc,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';
import { recomputedReminder } from './calendar-time';

function parseInstant(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw unprocessableException(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} must be a valid ISO 8601 datetime`,
    );
  }
  return date;
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Lists events overlapping the half-open window [from, to). Multi-day
   * events are included whole; the client clips them for rendering.
   */
  async list(from: string, to: string, calendarIds?: string[]): Promise<EventDto[]> {
    const fromDate = parseInstant(from, 'from');
    const toDate = parseInstant(to, 'to');
    if (toDate <= fromDate) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'to must be after from');
    }
    const events = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        startAt: { lt: toDate },
        endAt: { gt: fromDate },
        ...(calendarIds?.length ? { calendarId: { in: calendarIds } } : {}),
      },
      orderBy: [{ startAt: 'asc' }, { endAt: 'asc' }],
    });
    return events.map((e) => this.toDto(e));
  }

  /**
   * Idempotent create: the client submits a generated UUID (E11). A repeated
   * submission returns the original record instead of creating a duplicate.
   */
  async create(body: CreateEventDto): Promise<EventDto> {
    const existing = await this.prisma.event.findUnique({ where: { id: body.id } });
    if (existing) {
      return this.toDto(existing);
    }
    const calendar = await this.requireWritableCalendar(body.calendarId);
    const title = body.title.trim();
    if (!title) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty');
    }
    const timezone = this.normalizeTimezone(body.timezone);
    const allDay = body.allDay ?? false;
    const startAt = this.resolveInputTime(body.startAt, timezone, allDay, 'startAt');
    const endAt = this.resolveInputTime(body.endAt, timezone, allDay, 'endAt');
    this.validateTimes(startAt, endAt, allDay);

    const event = await this.prisma.event.create({
      data: {
        id: body.id,
        calendarId: calendar.id,
        title,
        startAt,
        endAt,
        allDay,
        timezone,
        location: body.location?.trim() ? body.location.trim() : null,
        description: body.description?.trim() ? body.description.trim() : null,
      },
    });
    return this.toDto(event);
  }

  /** Fetches a single active event. */
  async get(id: string): Promise<EventDto> {
    return this.toDto(await this.requireEvent(id));
  }

  async update(id: string, body: UpdateEventDto): Promise<EventDto> {
    const event = await this.requireEvent(id);
    if (body.updatedAt !== undefined) {
      const clientVersion = parseInstant(body.updatedAt, 'updatedAt');
      if (clientVersion.getTime() !== event.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the event was modified elsewhere; reload before saving',
        );
      }
    }
    if (body.calendarId !== undefined && body.calendarId !== event.calendarId) {
      await this.requireWritableCalendar(body.calendarId);
    }
    if (body.title !== undefined && body.title.trim().length === 0) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty');
    }

    const timezone =
      body.timezone !== undefined ? this.normalizeTimezone(body.timezone) : event.timezone;
    const allDay = body.allDay ?? event.allDay;

    let startAt =
      body.startAt !== undefined
        ? this.resolveInputTime(body.startAt, timezone, allDay, 'startAt')
        : event.startAt;
    let endAt =
      body.endAt !== undefined
        ? this.resolveInputTime(body.endAt, timezone, allDay, 'endAt')
        : event.endAt;

    // D2/E20: a timezone change without explicit times keeps the wall clock
    // and reinterprets it under the new zone (timed events only).
    if (
      body.timezone !== undefined &&
      timezone !== event.timezone &&
      body.startAt === undefined &&
      body.endAt === undefined &&
      !allDay
    ) {
      startAt = this.reinterpret(event.startAt, event.timezone, timezone);
      endAt = this.reinterpret(event.endAt, event.timezone, timezone);
    }

    const merged = {
      calendarId: body.calendarId ?? event.calendarId,
      title: body.title !== undefined ? body.title.trim() : event.title,
      startAt,
      endAt,
      allDay,
      timezone,
      location:
        body.location !== undefined
          ? body.location?.trim()
            ? body.location.trim()
            : null
          : event.location,
      description:
        body.description !== undefined
          ? body.description?.trim()
            ? body.description.trim()
            : null
          : event.description,
    };
    this.validateTimes(merged.startAt, merged.endAt, merged.allDay);

    const timeChanged =
      merged.startAt.getTime() !== event.startAt.getTime() ||
      merged.allDay !== event.allDay;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.event.update({
        where: { id },
        data: {
          calendarId: merged.calendarId,
          title: merged.title,
          startAt: merged.startAt,
          endAt: merged.endAt,
          allDay: merged.allDay,
          timezone: merged.timezone,
          location: merged.location,
          description: merged.description,
        },
      });
      // E7: pending reminders follow the new start; already-sent stay sent.
      if (timeChanged) {
        const reminders = await tx.reminder.findMany({
          where: { eventId: id, deletedAt: null },
        });
        for (const reminder of reminders) {
          if (reminder.status === 'sent') continue;
          const next = recomputedReminder(merged.startAt, reminder.offsetDays, now);
          await tx.reminder.update({
            where: { id: reminder.id },
            data: { triggerAt: next.triggerAt, status: next.status },
          });
        }
      }
      return saved;
    });
    return this.toDto(updated);
  }

  /** Soft-deletes the event; its reminders cascade (E8). */
  async remove(id: string): Promise<void> {
    await this.requireEvent(id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.event.update({ where: { id }, data: { deletedAt: now } }),
      this.prisma.reminder.updateMany({
        where: { eventId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);
  }

  /**
   * F4: normalizes the timezone field. undefined/null = floating time; a
   * string must be a valid IANA name (E19).
   */
  private normalizeTimezone(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    if (!isValidTimezone(trimmed)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'timezone must be a valid IANA timezone name or null (floating time)',
      );
    }
    return trimmed;
  }

  /**
   * F4: resolves a request datetime. Offset-bearing strings are absolute
   * instants (backward compatible); offset-less strings are wall clocks —
   * stored as UTC wall clock for floating events, resolved in the event's
   * zone for fixed-zone events. A wall clock that does not exist in the zone
   * (spring-forward gap) is rejected (E15); ambiguous fall-back clocks
   * resolve to the earlier occurrence (D4). All-day events keep accepting
   * only date-anchored UTC-midnight instants.
   */
  private resolveInputTime(
    value: string,
    timezone: string | null,
    allDay: boolean,
    field: string,
  ): Date {
    const parsed = parseEventTime(value);
    if (!parsed) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `${field} must be a valid ISO 8601 datetime`,
      );
    }
    if (parsed.kind === 'instant') return parsed.instant;
    if (allDay) {
      throw unprocessableException(
        ERROR_CODES.EVENT_TIME_INVALID,
        'all-day events must use date-anchored UTC-midnight instants',
      );
    }
    if (timezone === null) return floatingWallToUtc(parsed.wall);
    const resolved = zonedTimeToUtc(parsed.wall, timezone);
    if (!resolved) {
      throw unprocessableException(
        ERROR_CODES.EVENT_TIME_INVALID,
        `${field} does not exist in ${timezone} (DST gap)`,
      );
    }
    return resolved;
  }

  /**
   * F4 (D2/E20): reinterprets a stored instant under a new timezone while
   * preserving the wall clock. Floating storage reads as UTC wall clock;
   * becoming floating stores the old zone's wall clock as UTC.
   */
  private reinterpret(instant: Date, fromZone: string | null, toZone: string | null): Date {
    const wall = fromZone === null ? utcToFloatingWall(instant) : wallClockOf(instant, fromZone);
    if (toZone === null) return floatingWallToUtc(wall);
    const resolved = zonedTimeToUtc(wall, toZone);
    if (!resolved) {
      throw unprocessableException(
        ERROR_CODES.EVENT_TIME_INVALID,
        `the current wall clock does not exist in ${toZone} (DST gap)`,
      );
    }
    return resolved;
  }

  private validateTimes(startAt: Date, endAt: Date, allDay: boolean): void {
    if (endAt <= startAt) {
      throw unprocessableException(
        ERROR_CODES.EVENT_TIME_INVALID,
        'endAt must be after startAt',
      );
    }
    if (allDay && (startAt.getTime() % 86_400_000 !== 0 || endAt.getTime() % 86_400_000 !== 0)) {
      throw unprocessableException(
        ERROR_CODES.EVENT_TIME_INVALID,
        'all-day events must be date-anchored UTC midnights',
      );
    }
  }

  private async requireEvent(id: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({ where: { id, deletedAt: null } });
    if (!event) {
      throw notFoundException(ERROR_CODES.EVENT_NOT_FOUND, 'event not found');
    }
    return event;
  }

  /** Resolves a calendar and rejects read-only targets (E12). */
  private async requireWritableCalendar(id: string) {
    const calendar = await this.prisma.calendar.findFirst({
      where: { id, deletedAt: null },
    });
    if (!calendar) {
      throw notFoundException(ERROR_CODES.CALENDAR_NOT_FOUND, 'calendar not found');
    }
    if (calendar.readonly) {
      throw unprocessableException(
        ERROR_CODES.CALENDAR_READONLY,
        'events cannot be created in a read-only calendar',
      );
    }
    return calendar;
  }

  toDto(event: Event): EventDto {
    return {
      id: event.id,
      calendarId: event.calendarId,
      title: event.title,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      allDay: event.allDay,
      timezone: event.timezone,
      location: event.location,
      description: event.description,
      sourceModule: event.sourceModule,
      sourceRef: event.sourceRef,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
