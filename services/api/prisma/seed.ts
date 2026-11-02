import { loadEnv } from '../src/env';

loadEnv();

import { PrismaClient } from '@prisma/client';
import { seedReferenceData } from '../src/travel/seed-reference-data';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await seedReferenceData(prisma);
    // eslint-disable-next-line no-console
    console.log('Seed complete:', result);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
