import { Module } from '@nestjs/common';
import { MemoController } from './memo.controller';
import { MemoService } from './memo.service';
import { MemoImagesService } from './images.service';
import { ObjectStorageService } from './storage.service';

@Module({
  controllers: [MemoController],
  providers: [MemoService, MemoImagesService, ObjectStorageService],
  exports: [MemoService],
})
export class MemoModule {}
