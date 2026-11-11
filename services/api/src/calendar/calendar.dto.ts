import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CALENDAR_TYPES,
  REMINDER_PRESETS,
  type CalendarDto,
  type CalendarType,
  type DueReminderDto,
  type EventDto,
  type HolidayEntryDto,
  type ReminderDto,
  type ReminderPreset,
} from '@chpli2/shared';

// ---------------------------------------------------------------------------
// Calendar request bodies
// ---------------------------------------------------------------------------

export class CreateCalendarBody {
  @ApiProperty({ type: 'string', example: 'Personal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @ApiProperty({ type: 'string', example: '#0A84FF' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value like #0A84FF' })
  color!: string;

  @ApiProperty({ type: 'string', enum: CALENDAR_TYPES })
  @IsIn(CALENDAR_TYPES as string[])
  type!: CalendarType;

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    description: 'Required for subscription calendars, e.g. CN / DE-BY / CH-ZH',
  })
  @IsOptional()
  @IsString()
  regionCode?: string | null;
}

export class UpdateCalendarBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex value like #0A84FF' })
  color?: string;

  @ApiPropertyOptional({ type: 'boolean' })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ type: 'boolean', description: 'Make this calendar the default' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Event request bodies
// ---------------------------------------------------------------------------

export class CreateEventBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotency)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  @IsUUID()
  calendarId!: string;

  @ApiProperty({ type: 'string', example: 'Dentist' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  title!: string;

  @ApiProperty({ type: 'string', example: '2026-12-01T09:30:00+01:00' })
  @IsISO8601({ strict: true })
  startAt!: string;

  @ApiProperty({ type: 'string', example: '2026-12-01T10:30:00+01:00' })
  @IsISO8601({ strict: true })
  endAt!: string;

  @ApiPropertyOptional({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ type: 'string', example: 'Europe/Berlin' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  location?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class UpdateEventBody {
  @ApiPropertyOptional({ type: 'string', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  title?: string;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsISO8601({ strict: true })
  startAt?: string;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsISO8601({ strict: true })
  endAt?: string;

  @ApiPropertyOptional({ type: 'boolean' })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  location?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    description: 'Expected current updatedAt; mismatch -> 409 CONCURRENT_MODIFICATION',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Reminder request bodies
// ---------------------------------------------------------------------------

export class ReminderInputBody {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 30 })
  @IsInt()
  offsetDays!: number;

  @ApiProperty({ type: 'string', enum: REMINDER_PRESETS })
  @IsIn(REMINDER_PRESETS as string[])
  preset!: ReminderPreset;
}

export class ReplaceRemindersBody {
  @ApiProperty({ type: [ReminderInputBody] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReminderInputBody)
  reminders!: ReminderInputBody[];
}

// ---------------------------------------------------------------------------
// Response schemas for OpenAPI (mirror the DTO interfaces of @chpli2/shared)
// ---------------------------------------------------------------------------

export class CalendarEventDtoSchema {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) title!: string;
  @ApiProperty({ type: 'string' }) startsAt!: string;
  @ApiProperty({ type: 'string' }) endsAt!: string;
  @ApiProperty({ type: 'string' }) timezone!: string;
  @ApiProperty({
    type: 'object',
    properties: {
      module: { type: 'string', enum: ['travel'] },
      type: { type: 'string', enum: ['transport'] },
      id: { type: 'string' },
      tripId: { type: 'string' },
    },
  })
  source!: { module: 'travel'; type: 'transport'; id: string; tripId: string };
}

export class CalendarDtoSchema implements CalendarDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) color!: string;
  @ApiProperty({ type: 'string', enum: CALENDAR_TYPES }) type!: CalendarType;
  @ApiProperty({ type: 'boolean' }) readonly!: boolean;
  @ApiProperty({ type: 'string', nullable: true }) regionCode!: string | null;
  @ApiProperty({ type: 'boolean' }) isDefault!: boolean;
  @ApiProperty({ type: 'integer' }) sortOrder!: number;
  @ApiProperty({ type: 'boolean' }) hidden!: boolean;
  @ApiProperty({ type: 'string' }) createdAt!: string;
  @ApiProperty({ type: 'string' }) updatedAt!: string;
}

export class EventDtoSchema implements EventDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) calendarId!: string;
  @ApiProperty({ type: 'string' }) title!: string;
  @ApiProperty({ type: 'string' }) startAt!: string;
  @ApiProperty({ type: 'string' }) endAt!: string;
  @ApiProperty({ type: 'boolean' }) allDay!: boolean;
  @ApiProperty({ type: 'string' }) timezone!: string;
  @ApiProperty({ type: 'string', nullable: true }) location!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) description!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) sourceModule!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) sourceRef!: string | null;
  @ApiProperty({ type: 'string' }) createdAt!: string;
  @ApiProperty({ type: 'string' }) updatedAt!: string;
}

export class ReminderDtoSchema implements ReminderDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) eventId!: string;
  @ApiProperty({ type: 'integer' }) offsetDays!: number;
  @ApiProperty({ type: 'string', enum: REMINDER_PRESETS }) preset!: ReminderPreset;
  @ApiProperty({ type: 'string', enum: ['pending', 'sent', 'dismissed'] }) status!: ReminderDto['status'];
  @ApiProperty({ type: 'string' }) triggerAt!: string;
  @ApiProperty({ type: 'string', nullable: true }) sentAt!: string | null;
}

export class DueReminderDtoSchema extends ReminderDtoSchema implements DueReminderDto {
  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      startAt: { type: 'string' },
      allDay: { type: 'boolean' },
      calendarId: { type: 'string' },
      calendarColor: { type: 'string' },
    },
  })
  event!: DueReminderDto['event'];
}

export class HolidayEntryDtoSchema implements HolidayEntryDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) regionCode!: string;
  @ApiProperty({ type: 'string' }) date!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'boolean' }) isWorkday!: boolean;
}
