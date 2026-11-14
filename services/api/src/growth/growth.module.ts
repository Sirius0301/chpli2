import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { GrowthLinksService } from './growth-links.service';
import { NotesModule } from '../notes/notes.module';
import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { MemoModule } from '../memo/memo.module';

// Links are validated/resolved through the OWNING modules' exported services
// (notes/bookmarks/memos) — explicit imports, no table access across module
// boundaries (G1 D5 / G2 D3).
@Module({
  imports: [NotesModule, BookmarksModule, MemoModule],
  controllers: [GoalsController, SkillsController, ReviewsController],
  providers: [GoalsService, SkillsService, ReviewsService, GrowthLinksService],
  exports: [GoalsService],
})
export class GrowthModule {}
