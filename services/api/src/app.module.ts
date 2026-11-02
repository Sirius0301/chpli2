import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { TravelModule } from './travel/travel.module';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [SharedModule, TravelModule, CalendarModule],
})
export class AppModule {}
