import { Inject, Injectable } from '@nestjs/common';
import type { Calendar } from '@prisma/client';
import type { CalendarDto, CreateCalendarDto, UpdateCalendarDto } from '@chpli2/shared';
import { ERROR_CODES, HOLIDAY_REGION_CODES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

@Injectable()
export class CalendarService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async list(): Promise<CalendarDto[]> {
    const count = await this.prisma.calendar.count({ where: { deletedAt: null } });
    if (count === 0) {
      // A fresh single-user workspace starts with one default custom calendar
      // (domain rule: at least one custom calendar always remains, E2).
      await this.prisma.calendar.create({
        data: {
          name: 'Personal',
          color: '#0A84FF',
          type: 'custom',
          isDefault: true,
          sortOrder: 0,
        },
      });
    }
    const calendars = await this.prisma.calendar.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return calendars.map((c) => this.toDto(c));
  }

  async create(body: CreateCalendarDto): Promise<CalendarDto> {
    this.validateRegion(body.type, body.regionCode ?? null);
    if (!COLOR_PATTERN.test(body.color)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'color must be a hex value like #0A84FF',
      );
    }
    const existing = await this.prisma.calendar.count({ where: { deletedAt: null } });
    const calendar = await this.prisma.calendar.create({
      data: {
        name: body.name.trim(),
        color: body.color.toUpperCase(),
        type: body.type,
        readonly: body.type === 'subscription',
        regionCode: body.type === 'subscription' ? body.regionCode! : null,
        isDefault: existing === 0,
        sortOrder: existing,
      },
    });
    return this.toDto(calendar);
  }

  async update(id: string, body: UpdateCalendarDto): Promise<CalendarDto> {
    const calendar = await this.requireCalendar(id);
    if (
      calendar.readonly &&
      (body.name !== undefined || body.color !== undefined || body.sortOrder !== undefined)
    ) {
      throw unprocessableException(
        ERROR_CODES.CALENDAR_READONLY,
        'subscription calendars are read-only',
      );
    }
    if (body.color !== undefined && !COLOR_PATTERN.test(body.color)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'color must be a hex value like #0A84FF',
      );
    }
    if (body.name !== undefined && body.name.trim().length === 0) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'name must not be empty');
    }
    if (body.isDefault === true && !calendar.isDefault) {
      // Exactly one default: unset the previous one in the same transaction.
      await this.prisma.$transaction([
        this.prisma.calendar.updateMany({
          where: { isDefault: true, deletedAt: null },
          data: { isDefault: false },
        }),
        this.prisma.calendar.update({ where: { id }, data: { isDefault: true } }),
      ]);
    }
    const updated = await this.prisma.calendar.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.color !== undefined ? { color: body.color.toUpperCase() } : {}),
        ...(body.hidden !== undefined ? { hidden: body.hidden } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    });
    return this.toDto(updated);
  }

  /**
   * Deletes a calendar. When it still has events the caller must choose:
   * move them to another calendar (`moveTo`) or delete them together
   * (`deleteEvents`) — otherwise 409 (E1). The last custom calendar cannot
   * be deleted (E2, 422).
   */
  async remove(
    id: string,
    opts: { moveTo?: string; deleteEvents?: boolean } = {},
  ): Promise<void> {
    const { moveTo, deleteEvents } = opts;
    const calendar = await this.requireCalendar(id);
    const eventCount = await this.prisma.event.count({
      where: { calendarId: id, deletedAt: null },
    });
    if (eventCount > 0 && !moveTo && !deleteEvents) {
      throw conflictException(
        ERROR_CODES.CALENDAR_DELETE_REQUIRES_TARGET,
        `calendar has ${eventCount} events; choose to move or delete them`,
      );
    }
    if (calendar.type === 'custom') {
      const customCount = await this.prisma.calendar.count({
        where: { type: 'custom', deletedAt: null },
      });
      if (customCount <= 1) {
        throw unprocessableException(
          ERROR_CODES.LAST_CUSTOM_CALENDAR,
          'at least one custom calendar must remain',
        );
      }
    }
    if (moveTo) {
      const target = await this.prisma.calendar.findFirst({
        where: { id: moveTo, deletedAt: null },
      });
      if (!target) {
        throw notFoundException(ERROR_CODES.CALENDAR_NOT_FOUND, 'target calendar not found');
      }
      if (target.readonly) {
        throw unprocessableException(
          ERROR_CODES.CALENDAR_READONLY,
          'events cannot be moved to a read-only calendar',
        );
      }
      await this.prisma.event.updateMany({
        where: { calendarId: id, deletedAt: null },
        data: { calendarId: moveTo },
      });
    } else if (deleteEvents && eventCount > 0) {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.reminder.updateMany({
          where: { event: { calendarId: id }, deletedAt: null },
          data: { deletedAt: now },
        }),
        this.prisma.event.updateMany({
          where: { calendarId: id, deletedAt: null },
          data: { deletedAt: now },
        }),
      ]);
    }
    await this.prisma.$transaction([
      this.prisma.calendar.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isDefault: false,
          hidden: true,
        },
      }),
      // A deleted default calendar passes the default flag to the move target,
      // or to the first remaining custom calendar.
      ...(calendar.isDefault
        ? [
            this.prisma.calendar.updateMany({
              where: {
                deletedAt: null,
                id: moveTo ?? undefined,
                type: 'custom',
                isDefault: false,
              },
              data: { isDefault: true },
            }),
          ]
        : []),
    ]);
    // If the default was not reassigned (e.g. deleted without moveTo), make
    // sure some custom calendar is default.
    if (calendar.isDefault) {
      const remaining = await this.prisma.calendar.count({
        where: { deletedAt: null, isDefault: true },
      });
      if (remaining === 0) {
        const first = await this.prisma.calendar.findFirst({
          where: { deletedAt: null, type: 'custom' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (first) {
          await this.prisma.calendar.update({
            where: { id: first.id },
            data: { isDefault: true },
          });
        }
      }
    }
  }

  private validateRegion(type: string, regionCode: string | null): void {
    if (type === 'subscription') {
      if (!regionCode) {
        throw unprocessableException(
          ERROR_CODES.HOLIDAY_REGION_REQUIRED,
          'subscription calendars require a region code',
        );
      }
      if (!(HOLIDAY_REGION_CODES as readonly string[]).includes(regionCode)) {
        throw unprocessableException(
          ERROR_CODES.HOLIDAY_REGION_REQUIRED,
          `unknown holiday region "${regionCode}"`,
        );
      }
    } else if (regionCode) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'custom calendars must not carry a region code',
      );
    }
  }

  private async requireCalendar(id: string): Promise<Calendar> {
    const calendar = await this.prisma.calendar.findFirst({
      where: { id, deletedAt: null },
    });
    if (!calendar) {
      throw notFoundException(ERROR_CODES.CALENDAR_NOT_FOUND, 'calendar not found');
    }
    return calendar;
  }

  toDto(calendar: Calendar): CalendarDto {
    return {
      id: calendar.id,
      name: calendar.name,
      color: calendar.color,
      type: calendar.type as CalendarDto['type'],
      readonly: calendar.readonly,
      regionCode: calendar.regionCode,
      isDefault: calendar.isDefault,
      sortOrder: calendar.sortOrder,
      hidden: calendar.hidden,
      createdAt: calendar.createdAt.toISOString(),
      updatedAt: calendar.updatedAt.toISOString(),
    };
  }
}
