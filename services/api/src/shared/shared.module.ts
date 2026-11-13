import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OutboxDispatcher } from './outbox-dispatcher';
import { ObjectStorageService } from './object-storage.service';

@Global()
@Module({
  providers: [PrismaService, OutboxDispatcher, ObjectStorageService],
  exports: [PrismaService, OutboxDispatcher, ObjectStorageService],
})
export class SharedModule {}
