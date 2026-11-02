import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { seedReferenceData, type SeedResult } from './seed-reference-data';

@Injectable()
export class SeedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Development only: idempotently inserts reference countries/cities/locations. */
  async seed(): Promise<SeedResult> {
    return seedReferenceData(this.prisma);
  }
}
