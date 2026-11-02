import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CityDto, CountryDto, LocationDto } from '@chpli2/shared';
import { GeoService } from './geo.service';
import { CityDtoSchema, CountryDtoSchema, LocationDtoSchema } from './travel.dto';

@ApiTags('travel')
@Controller('travel')
export class GeoController {
  constructor(
    @Inject(GeoService) private readonly geoService: GeoService,
  ) {}

  @Get('countries')
  @ApiOperation({ summary: 'List all countries' })
  @ApiOkResponse({ type: [CountryDtoSchema] })
  listCountries(): Promise<CountryDto[]> {
    return this.geoService.listCountries();
  }

  @Get('countries/:id/cities')
  @ApiOperation({ summary: 'List cities of a country' })
  @ApiOkResponse({ type: [CityDtoSchema] })
  listCities(@Param('id') countryId: string): Promise<CityDto[]> {
    return this.geoService.listCities(countryId);
  }

  @Get('cities/:id/locations')
  @ApiOperation({ summary: 'List locations of a city' })
  @ApiOkResponse({ type: [LocationDtoSchema] })
  listLocations(@Param('id') cityId: string): Promise<LocationDto[]> {
    return this.geoService.listLocations(cityId);
  }
}
