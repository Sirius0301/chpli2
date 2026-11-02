import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ROUTE_LEVELS,
  TRANSPORT_MODES,
  type CalendarSyncStateDto,
  type RouteEndpointDto,
  type RouteEndpointRef,
  type TransportDto,
  type TransportMode,
  type TripDto,
  type TripType,
} from '@chpli2/shared';

// ---------------------------------------------------------------------------
// Request bodies (class-validator)
// ---------------------------------------------------------------------------

export class RouteEndpointRefBody implements RouteEndpointRef {
  @ApiProperty({ type: 'string', enum: ROUTE_LEVELS })
  @IsIn(ROUTE_LEVELS as string[])
  level!: RouteEndpointRef['level'];

  @ApiProperty({ type: 'string' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class CreateTripBody {
  @ApiProperty({ type: 'string', example: 'Christmas markets 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ type: 'string', enum: ['PLAN', 'MEMORY'] })
  @IsIn(['PLAN', 'MEMORY'])
  type!: TripType;
}

class TransportTimes {
  @ApiPropertyOptional({ type: 'string', nullable: true, example: '2026-12-01T09:30:00+01:00' })
  @IsOptional()
  @IsISO8601({ strict: true })
  plannedDepartureAt?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true, example: '2026-12-01T11:45:00+01:00' })
  @IsOptional()
  @IsISO8601({ strict: true })
  plannedArrivalAt?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  actualDepartureAt?: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  actualArrivalAt?: string | null;
}

export class CreateTransportBody extends TransportTimes {
  @ApiProperty({ type: 'string', enum: TRANSPORT_MODES })
  @IsIn(TRANSPORT_MODES as string[])
  mode!: TransportMode;

  @ApiProperty({ type: RouteEndpointRefBody })
  @ValidateNested()
  @Type(() => RouteEndpointRefBody)
  origin!: RouteEndpointRefBody;

  @ApiProperty({ type: RouteEndpointRefBody })
  @ValidateNested()
  @Type(() => RouteEndpointRefBody)
  destination!: RouteEndpointRefBody;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Ignored for MEMORY trips. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  syncToCalendar?: boolean;
}

export class UpdateTransportBody extends TransportTimes {
  @ApiPropertyOptional({ type: 'string', enum: TRANSPORT_MODES })
  @IsOptional()
  @IsIn(TRANSPORT_MODES as string[])
  mode?: TransportMode;

  @ApiPropertyOptional({ type: RouteEndpointRefBody })
  @IsOptional()
  @ValidateNested()
  @Type(() => RouteEndpointRefBody)
  origin?: RouteEndpointRefBody;

  @ApiPropertyOptional({ type: RouteEndpointRefBody })
  @IsOptional()
  @ValidateNested()
  @Type(() => RouteEndpointRefBody)
  destination?: RouteEndpointRefBody;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  syncToCalendar?: boolean;
}

// ---------------------------------------------------------------------------
// Response schemas for OpenAPI (mirror the DTO interfaces of @chpli2/shared)
// ---------------------------------------------------------------------------

export class RouteEndpointDtoSchema implements RouteEndpointDto {
  @ApiProperty({ type: 'string', enum: ROUTE_LEVELS }) level!: RouteEndpointDto['level'];
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiPropertyOptional({ type: 'string', nullable: true }) cityId?: string;
}

export class TransportDtoSchema implements TransportDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) tripId!: string;
  @ApiProperty({ type: 'string', enum: TRANSPORT_MODES }) mode!: TransportMode;
  @ApiProperty({ type: RouteEndpointDtoSchema }) origin!: RouteEndpointDto;
  @ApiProperty({ type: RouteEndpointDtoSchema }) destination!: RouteEndpointDto;
  @ApiProperty({ type: 'string', nullable: true }) plannedDepartureAt!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) plannedArrivalAt!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) actualDepartureAt!: string | null;
  @ApiProperty({ type: 'string', nullable: true }) actualArrivalAt!: string | null;
  @ApiProperty({
    nullable: true,
    type: 'object',
    properties: {
      eventId: { type: 'string' },
      syncKey: { type: 'string' },
      syncedAt: { type: 'string' },
      status: { type: 'string', enum: ['SYNCED', 'PENDING_DELETE'] },
    },
  })
  calendarSync!: CalendarSyncStateDto | null;
}

export class TripDtoSchema implements TripDto {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) title!: string;
  @ApiProperty({ type: 'string', enum: ['PLAN', 'MEMORY'] }) type!: TripType;
  @ApiProperty({ type: 'string' }) createdAt!: string;
  @ApiProperty({ type: 'string' }) updatedAt!: string;
  @ApiProperty({ type: [TransportDtoSchema] }) transports!: TransportDto[];
}

export class CountryDtoSchema {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) name!: string;
  @ApiProperty({ type: 'string' }) code!: string;
}

export class CityDtoSchema {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) countryId!: string;
  @ApiProperty({ type: 'string' }) name!: string;
}

export class LocationDtoSchema {
  @ApiProperty({ type: 'string' }) id!: string;
  @ApiProperty({ type: 'string' }) cityId!: string;
  @ApiProperty({ type: 'string' }) name!: string;
}
