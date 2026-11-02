import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { TravelService } from './travel.service';
import { TransportMapper } from './transport-mapper';
import { GeoService } from './geo.service';
import { SeedService } from './seed.service';
import { TravelController } from './travel.controller';
import { GeoController } from './geo.controller';
import { SeedController } from './seed.controller';

@Module({
  imports: [CalendarModule], // read-only CalendarSyncStatusService access
  controllers: [TravelController, GeoController, SeedController],
  providers: [TravelService, TransportMapper, GeoService, SeedService],
  exports: [TravelService],
})
export class TravelModule {}
