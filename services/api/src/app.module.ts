import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { TravelModule } from './travel/travel.module';
import { CalendarModule } from './calendar/calendar.module';
import { MemoModule } from './memo/memo.module';
import { NotesModule } from './notes/notes.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [SharedModule, AuthModule, TravelModule, CalendarModule, MemoModule, NotesModule],
})
export class AppModule {}
