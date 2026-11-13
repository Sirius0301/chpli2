import { Module } from '@nestjs/common';
import { MemoController } from './memo.controller';
import { MemoService } from './memo.service';
import { MemoImagesService } from './images.service';

@Module({
  controllers: [MemoController],
  providers: [MemoService, MemoImagesService],
  exports: [MemoService],
})
export class MemoModule {}
