import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  CalendarEventDto,
  CalendarSyncStateDto,
} from '@chpli2/shared';

/** Swagger schema mirroring CalendarSyncStateDto from @chpli2/shared. */
export class CalendarSyncStateDtoSchema implements CalendarSyncStateDto {
  @ApiProperty({ type: 'string' }) eventId!: string;
  @ApiProperty({ type: 'string' }) syncKey!: string;
  @ApiProperty({ type: 'string' }) syncedAt!: string;
  @ApiProperty({ type: 'string', enum: ['SYNCED', 'PENDING_DELETE'] }) status!:
    | 'SYNCED'
    | 'PENDING_DELETE';
}

class EventSourceSchema {
  @ApiProperty({ type: 'string', enum: ['travel'] }) module!: 'travel';
  @ApiProperty({ type: 'string', enum: ['transport'] }) type!: 'transport';
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) tripId!: string;
}

/** Swagger schema mirroring CalendarEventDto from @chpli2/shared. */
export class CalendarEventDtoSchema implements CalendarEventDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) title!: string;
  @ApiProperty({ type: 'string' }) startsAt!: string;
  @ApiProperty({ type: 'string' }) endsAt!: string;
  @ApiProperty({ type: 'string' }) timezone!: string;
  @ApiProperty({ type: EventSourceSchema }) source!: CalendarEventDto['source'];
}
