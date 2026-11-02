import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { TransportDto, TripDto } from '@chpli2/shared';
import { ValidatedBody } from '../shared/validate-dto';
import { TravelService } from './travel.service';
import {
  CreateTransportBody,
  CreateTripBody,
  TransportDtoSchema,
  TripDtoSchema,
  UpdateTransportBody,
} from './travel.dto';

@ApiTags('travel')
@Controller('travel')
export class TravelController {
  constructor(
    @Inject(TravelService) private readonly travelService: TravelService,
  ) {}

  @Post('trips')
  @ApiOperation({ summary: 'Create a trip' })
  @ApiCreatedResponse({ type: TripDtoSchema })
  createTrip(@ValidatedBody(CreateTripBody) body: CreateTripBody): Promise<TripDto> {
    return this.travelService.createTrip(body);
  }

  @Get('trips/:id')
  @ApiOperation({ summary: 'Get a trip with its transports' })
  @ApiOkResponse({ type: TripDtoSchema })
  getTrip(@Param('id') id: string): Promise<TripDto> {
    return this.travelService.getTrip(id);
  }

  @Post('trips/:id/transports')
  @ApiOperation({ summary: 'Add a transport segment to a trip' })
  @ApiCreatedResponse({ type: TransportDtoSchema })
  createTransport(
    @Param('id') tripId: string,
    @ValidatedBody(CreateTransportBody) body: CreateTransportBody,
  ): Promise<TransportDto> {
    return this.travelService.createTransport(tripId, body);
  }

  @Patch('transports/:id')
  @ApiOperation({ summary: 'Update a transport segment' })
  @ApiOkResponse({ type: TransportDtoSchema })
  updateTransport(
    @Param('id') id: string,
    @ValidatedBody(UpdateTransportBody) body: UpdateTransportBody,
  ): Promise<TransportDto> {
    return this.travelService.updateTransport(id, body);
  }

  @Delete('transports/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a transport segment (confirmation happens in the UI)',
  })
  @ApiNoContentResponse({ description: 'Transport deleted' })
  async deleteTransport(@Param('id') id: string): Promise<void> {
    await this.travelService.deleteTransport(id);
  }
}
