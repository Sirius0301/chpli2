import { Inject, Injectable } from '@nestjs/common';
import type { CityDto, CountryDto, LocationDto } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';

@Injectable()
export class GeoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  listCountries(): Promise<CountryDto[]> {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async listCities(countryId: string): Promise<CityDto[]> {
    return this.prisma.city.findMany({
      where: { countryId },
      orderBy: { name: 'asc' },
    });
  }

  async listLocations(cityId: string): Promise<LocationDto[]> {
    return this.prisma.location.findMany({
      where: { cityId },
      orderBy: { name: 'asc' },
    });
  }
}
