import type { PrismaClient } from '@prisma/client';

interface SeedLocation {
  name: string;
  locations: string[];
}

interface SeedCountry {
  name: string;
  code: string;
  cities: SeedLocation[];
}

/** Development reference data: countries, cities and city locations. */
export const REFERENCE_SEED: SeedCountry[] = [
  {
    name: 'China',
    code: 'CN',
    cities: [
      {
        name: 'Beijing',
        locations: ['Forbidden City', 'Temple of Heaven', 'Great Wall (Badaling)'],
      },
      {
        name: 'Shanghai',
        locations: ['The Bund', 'Yu Garden', 'Oriental Pearl Tower'],
      },
    ],
  },
  {
    name: 'Germany',
    code: 'DE',
    cities: [
      {
        name: 'Berlin',
        locations: ['Brandenburg Gate', 'Berlin Wall Memorial', 'Museum Island'],
      },
      {
        name: 'Munich',
        locations: ['Marienplatz', 'English Garden', 'Nymphenburg Palace'],
      },
    ],
  },
  {
    name: 'Japan',
    code: 'JP',
    cities: [
      {
        name: 'Tokyo',
        locations: ['Senso-ji', 'Meiji Shrine', 'Shibuya Crossing'],
      },
      {
        name: 'Osaka',
        locations: ['Osaka Castle', 'Dotonbori', 'Universal Studios Japan'],
      },
    ],
  },
];

export interface SeedResult {
  countries: number;
  cities: number;
  locations: number;
}

/** Idempotent upsert of the development reference data. */
export async function seedReferenceData(prisma: PrismaClient): Promise<SeedResult> {
  let cities = 0;
  let locations = 0;
  for (const country of REFERENCE_SEED) {
    const countryRow = await prisma.country.upsert({
      where: { code: country.code },
      create: { name: country.name, code: country.code },
      update: {},
    });
    for (const city of country.cities) {
      const cityRow = await prisma.city.upsert({
        where: { countryId_name: { countryId: countryRow.id, name: city.name } },
        create: { countryId: countryRow.id, name: city.name },
        update: {},
      });
      cities += 1;
      for (const location of city.locations) {
        await prisma.location.upsert({
          where: { cityId_name: { cityId: cityRow.id, name: location } },
          create: { cityId: cityRow.id, name: location },
          update: {},
        });
        locations += 1;
      }
    }
  }
  return { countries: REFERENCE_SEED.length, cities, locations };
}
