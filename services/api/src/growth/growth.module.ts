import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { NotesModule } from '../notes/notes.module';
import { BookmarksModule } from '../bookmarks/bookmarks.module';

// Links are validated/resolved through the OWNING modules' exported services
// (G1 D5) — explicit imports, no table access across module boundaries.
@Module({
  imports: [NotesModule, BookmarksModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GrowthModule {}
