import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncStatusService } from './calendar-sync-status.service';
import { EventsService } from './events.service';
import { RemindersService } from './reminders.service';
import { HolidaysService } from './holidays.service';
import { TravelEventsService } from './travel-events.service';

@Module({
  controllers: [CalendarController],
  providers: [
    CalendarService,
    EventsService,
    RemindersService,
    HolidaysService,
    TravelEventsService,
    CalendarSyncService,
    CalendarSyncStatusService,
  ],
  exports: [CalendarService, CalendarSyncStatusService],
})
export class CalendarModule {}
