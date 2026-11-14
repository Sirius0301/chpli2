import { Module } from '@nestjs/common';
import { LifeFolderController } from './lifefolder.controller';
import { LifeFolderService } from './lifefolder.service';

@Module({
  controllers: [LifeFolderController],
  providers: [LifeFolderService],
  exports: [LifeFolderService],
})
export class LifeFolderModule {}
