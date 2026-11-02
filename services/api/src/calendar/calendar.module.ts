import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncStatusService } from './calendar-sync-status.service';

@Module({
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarSyncService,
    CalendarSyncStatusService,
  ],
  exports: [CalendarService, CalendarSyncStatusService],
})
export class CalendarModule {}
