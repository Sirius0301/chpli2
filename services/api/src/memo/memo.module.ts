import { Module } from '@nestjs/common';
import { MemoController } from './memo.controller';
import { MemoService } from './memo.service';

@Module({
  controllers: [MemoController],
  providers: [MemoService],
  exports: [MemoService],
})
export class MemoModule {}
