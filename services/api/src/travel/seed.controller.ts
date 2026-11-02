import { Controller, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import type { SeedResult } from './seed-reference-data';

@ApiTags('travel')
@Controller('travel')
export class SeedController {
  constructor(
    @Inject(SeedService) private readonly seedService: SeedService,
  ) {}

  @Post('seed')
  @ApiOperation({
    summary: 'Insert development reference data (DEV ONLY)',
    deprecated: true,
    description:
      'DEV ONLY — idempotently inserts reference countries, cities and ' +
      'locations (China/Germany/Japan etc.). Never call in production.',
  })
  seed(): Promise<SeedResult> {
    return this.seedService.seed();
  }
}
