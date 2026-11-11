import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import type {
  CalendarDto,
  CalendarEventDto,
  DueReminderDto,
  EventDto,
  HolidayEntryDto,
  ReminderDto,
} from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CalendarService } from './calendar.service';
import { EventsService } from './events.service';
import { RemindersService } from './reminders.service';
import { HolidaysService } from './holidays.service';
import { TravelEventsService } from './travel-events.service';
import {
  CalendarDtoSchema,
  CalendarEventDtoSchema,
  CreateCalendarBody,
  CreateEventBody,
  DueReminderDtoSchema,
  EventDtoSchema,
  HolidayEntryDtoSchema,
  ReminderDtoSchema,
  ReplaceRemindersBody,
  UpdateCalendarBody,
  UpdateEventBody,
} from './calendar.dto';

export class ListEventsQuery {
  @ApiPropertyOptional({ type: 'string', description: 'ISO 8601 window start (inclusive)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: 'string', description: 'ISO 8601 window end (exclusive)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Comma-separated calendar ids; empty means all visible',
  })
  @IsOptional()
  @IsString()
  calendar_ids?: string;
}

export class DueRemindersQuery {
  @ApiPropertyOptional({ type: 'string', description: 'ISO 8601 upper bound (default: now)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Comma-separated calendar ids' })
  @IsOptional()
  @IsString()
  calendar_ids?: string;
}

export class HolidaysQuery {
  @ApiPropertyOptional({ type: 'string', description: 'Comma-separated region codes' })
  @IsOptional()
  @IsString()
  region_codes?: string;

  @ApiPropertyOptional({ type: 'string', description: 'ISO date window start' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ type: 'string', description: 'ISO date window end' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ type: 'string', enum: ['zh', 'en', 'de'], default: 'en' })
  @IsOptional()
  @IsString()
  lang?: string;
}

export class TravelEventsQuery {
  @ApiPropertyOptional({ type: 'string', description: 'Optional ISO 8601 lower bound on startsAt' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Optional ISO 8601 upper bound on startsAt' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

function parseCalendarIds(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(
    @Inject(CalendarService) private readonly calendarService: CalendarService,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(RemindersService) private readonly remindersService: RemindersService,
    @Inject(HolidaysService) private readonly holidaysService: HolidaysService,
    @Inject(TravelEventsService) private readonly travelEventsService: TravelEventsService,
  ) {}

  // -- Calendars ------------------------------------------------------------

  @Get('calendars')
  @ApiOperation({ summary: 'List calendars (custom + subscriptions)' })
  @ApiOkResponse({ type: [CalendarDtoSchema] })
  listCalendars(): Promise<CalendarDto[]> {
    return this.calendarService.list();
  }

  @Post('calendars')
  @ApiOperation({ summary: 'Create a calendar' })
  @ApiCreatedResponse({ type: CalendarDtoSchema })
  createCalendar(@ValidatedBody(CreateCalendarBody) body: CreateCalendarBody): Promise<CalendarDto> {
    return this.calendarService.create(body);
  }

  @Patch('calendars/:id')
  @ApiOperation({ summary: 'Update a calendar (name/color/hidden/default/sort)' })
  @ApiOkResponse({ type: CalendarDtoSchema })
  updateCalendar(
    @Param('id') id: string,
    @ValidatedBody(UpdateCalendarBody) body: UpdateCalendarBody,
  ): Promise<CalendarDto> {
    return this.calendarService.update(id, body);
  }

  @Delete('calendars/:id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Delete a calendar; with events requires ?move_to= (409 otherwise). Last custom calendar is protected (422).',
  })
  @ApiNoContentResponse({ description: 'Calendar deleted' })
  async deleteCalendar(
    @Param('id') id: string,
    @Query('move_to') moveTo?: string,
    @Query('delete_events') deleteEvents?: string,
  ): Promise<void> {
    await this.calendarService.remove(id, {
      moveTo,
      deleteEvents: deleteEvents === 'true' || deleteEvents === '1',
    });
  }

  // -- Events ---------------------------------------------------------------

  @Get('events')
  @ApiOperation({ summary: 'List user events overlapping the given window' })
  @ApiOkResponse({ type: [EventDtoSchema] })
  listEvents(@ValidatedQuery(ListEventsQuery) query: ListEventsQuery): Promise<EventDto[]> {
    return this.eventsService.list(
      query.from ?? new Date(Date.now() - 31 * 86_400_000).toISOString(),
      query.to ?? new Date(Date.now() + 366 * 86_400_000).toISOString(),
      parseCalendarIds(query.calendar_ids),
    );
  }

  @Post('events')
  @ApiOperation({ summary: 'Create an event (idempotent on the client-generated id)' })
  @ApiCreatedResponse({ type: EventDtoSchema })
  createEvent(@ValidatedBody(CreateEventBody) body: CreateEventBody): Promise<EventDto> {
    return this.eventsService.create(body);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get a single event' })
  @ApiOkResponse({ type: EventDtoSchema })
  getEvent(@Param('id') id: string): Promise<EventDto> {
    return this.eventsService.get(id);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Update an event (optimistic lock via updatedAt)' })
  @ApiOkResponse({ type: EventDtoSchema })
  updateEvent(
    @Param('id') id: string,
    @ValidatedBody(UpdateEventBody) body: UpdateEventBody,
  ): Promise<EventDto> {
    return this.eventsService.update(id, body);
  }

  @Delete('events/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an event (soft delete; reminders cascade)' })
  @ApiNoContentResponse({ description: 'Event deleted' })
  async deleteEvent(@Param('id') id: string): Promise<void> {
    await this.eventsService.remove(id);
  }

  // -- Reminders ------------------------------------------------------------

  @Get('events/:id/reminders')
  @ApiOperation({ summary: 'List the reminders of an event' })
  @ApiOkResponse({ type: [ReminderDtoSchema] })
  listReminders(@Param('id') eventId: string): Promise<ReminderDto[]> {
    return this.remindersService.listForEvent(eventId);
  }

  @Put('events/:id/reminders')
  @ApiOperation({ summary: 'Replace the reminder set of an event' })
  @ApiOkResponse({ type: [ReminderDtoSchema] })
  replaceReminders(
    @Param('id') eventId: string,
    @ValidatedBody(ReplaceRemindersBody) body: ReplaceRemindersBody,
  ): Promise<ReminderDto[]> {
    return this.remindersService.replace(eventId, body.reminders);
  }

  @Get('reminders/due')
  @ApiOperation({ summary: 'Pending reminders due before a time (sidebar list)' })
  @ApiOkResponse({ type: [DueReminderDtoSchema] })
  dueReminders(@ValidatedQuery(DueRemindersQuery) query: DueRemindersQuery): Promise<DueReminderDto[]> {
    return this.remindersService.due(query.before, parseCalendarIds(query.calendar_ids));
  }

  // -- Holidays ---------------------------------------------------------------

  @Get('holidays')
  @ApiOperation({ summary: 'Read-only holiday entries for subscribed regions' })
  @ApiOkResponse({ type: [HolidayEntryDtoSchema] })
  holidays(@ValidatedQuery(HolidaysQuery) query: HolidaysQuery): Promise<HolidayEntryDto[]> {
    const now = new Date();
    const year = now.getUTCFullYear();
    return this.holidaysService.list(
      parseCalendarIds(query.region_codes) ?? [],
      query.from ?? `${year - 1}-01-01`,
      query.to ?? `${year + 2}-12-31`,
      query.lang ?? 'en',
    );
  }

  // -- Travel-synced projection (read-only, owned by the travel sync) ---------

  @Get('travel-events')
  @ApiOperation({ summary: 'List travel-synced calendar events (read-only projection)' })
  @ApiOkResponse({ type: [CalendarEventDtoSchema] })
  listTravelEvents(@ValidatedQuery(TravelEventsQuery) query: TravelEventsQuery): Promise<CalendarEventDto[]> {
    return this.travelEventsService.list(query.from, query.to);
  }
}
