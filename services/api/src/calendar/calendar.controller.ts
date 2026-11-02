import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { CalendarEventDto } from '@chpli2/shared';
import { IsISO8601, IsOptional } from 'class-validator';
import { ValidatedQuery } from '../shared/validate-dto';
import { CalendarService } from './calendar.service';
import { CalendarEventDtoSchema } from './calendar.dto';

export class ListEventsQuery {
  @ApiPropertyOptional({ type: 'string', description: 'Optional ISO 8601 lower bound on startsAt' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Optional ISO 8601 upper bound on startsAt' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

@ApiTags('calendar')
@Controller('calendar')
export class CalendarController {
  constructor(
    @Inject(CalendarService) private readonly calendarService: CalendarService,
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'List active calendar events ordered by startsAt' })
  @ApiOkResponse({ type: [CalendarEventDtoSchema] })
  list(@ValidatedQuery(ListEventsQuery) query: ListEventsQuery): Promise<CalendarEventDto[]> {
    return this.calendarService.list(query.from, query.to);
  }
}
