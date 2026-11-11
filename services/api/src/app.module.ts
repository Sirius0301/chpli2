import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { TravelModule } from './travel/travel.module';
import { CalendarModule } from './calendar/calendar.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule, TravelModule, CalendarModule],
})
export class AppModule {}
