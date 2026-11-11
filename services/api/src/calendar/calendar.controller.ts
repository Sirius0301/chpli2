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
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
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
  listCalendars(@CurrentUser() user: AuthPrincipal): Promise<CalendarDto[]> {
    return this.calendarService.list(user.userId);
  }

  @Post('calendars')
  @ApiOperation({ summary: 'Create a calendar' })
  @ApiCreatedResponse({ type: CalendarDtoSchema })
  createCalendar(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateCalendarBody) body: CreateCalendarBody,
  ): Promise<CalendarDto> {
    return this.calendarService.create(user.userId, body);
  }

  @Patch('calendars/:id')
  @ApiOperation({ summary: 'Update a calendar (name/color/hidden/default/sort)' })
  @ApiOkResponse({ type: CalendarDtoSchema })
  updateCalendar(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateCalendarBody) body: UpdateCalendarBody,
  ): Promise<CalendarDto> {
    return this.calendarService.update(user.userId, id, body);
  }

  @Delete('calendars/:id')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Delete a calendar; with events requires ?move_to= (409 otherwise). Last custom calendar is protected (422).',
  })
  @ApiNoContentResponse({ description: 'Calendar deleted' })
  async deleteCalendar(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Query('move_to') moveTo?: string,
    @Query('delete_events') deleteEvents?: string,
  ): Promise<void> {
    await this.calendarService.remove(user.userId, id, {
      moveTo,
      deleteEvents: deleteEvents === 'true' || deleteEvents === '1',
    });
  }

  // -- Events ---------------------------------------------------------------

  @Get('events')
  @ApiOperation({ summary: 'List user events overlapping the given window' })
  @ApiOkResponse({ type: [EventDtoSchema] })
  listEvents(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(ListEventsQuery) query: ListEventsQuery,
  ): Promise<EventDto[]> {
    return this.eventsService.list(
      user.userId,
      query.from ?? new Date(Date.now() - 31 * 86_400_000).toISOString(),
      query.to ?? new Date(Date.now() + 366 * 86_400_000).toISOString(),
      parseCalendarIds(query.calendar_ids),
    );
  }

  @Post('events')
  @ApiOperation({ summary: 'Create an event (idempotent on the client-generated id)' })
  @ApiCreatedResponse({ type: EventDtoSchema })
  createEvent(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateEventBody) body: CreateEventBody,
  ): Promise<EventDto> {
    return this.eventsService.create(user.userId, body);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get a single event' })
  @ApiOkResponse({ type: EventDtoSchema })
  getEvent(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<EventDto> {
    return this.eventsService.get(user.userId, id);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Update an event (optimistic lock via updatedAt)' })
  @ApiOkResponse({ type: EventDtoSchema })
  updateEvent(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateEventBody) body: UpdateEventBody,
  ): Promise<EventDto> {
    return this.eventsService.update(user.userId, id, body);
  }

  @Delete('events/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an event (soft delete; reminders cascade)' })
  @ApiNoContentResponse({ description: 'Event deleted' })
  async deleteEvent(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.eventsService.remove(user.userId, id);
  }

  // -- Reminders ------------------------------------------------------------

  @Get('events/:id/reminders')
  @ApiOperation({ summary: 'List the reminders of an event' })
  @ApiOkResponse({ type: [ReminderDtoSchema] })
  listReminders(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') eventId: string,
  ): Promise<ReminderDto[]> {
    return this.remindersService.listForEvent(user.userId, eventId);
  }

  @Put('events/:id/reminders')
  @ApiOperation({ summary: 'Replace the reminder set of an event' })
  @ApiOkResponse({ type: [ReminderDtoSchema] })
  replaceReminders(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') eventId: string,
    @ValidatedBody(ReplaceRemindersBody) body: ReplaceRemindersBody,
  ): Promise<ReminderDto[]> {
    return this.remindersService.replace(user.userId, eventId, body.reminders);
  }

  @Get('reminders/due')
  @ApiOperation({ summary: 'Pending reminders due before a time (sidebar list)' })
  @ApiOkResponse({ type: [DueReminderDtoSchema] })
  dueReminders(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(DueRemindersQuery) query: DueRemindersQuery,
  ): Promise<DueReminderDto[]> {
    return this.remindersService.due(user.userId, query.before, parseCalendarIds(query.calendar_ids));
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
  listTravelEvents(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(TravelEventsQuery) query: TravelEventsQuery,
  ): Promise<CalendarEventDto[]> {
    return this.travelEventsService.list(user.userId, query.from, query.to);
  }
}
