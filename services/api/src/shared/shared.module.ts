import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OutboxDispatcher } from './outbox-dispatcher';

@Global()
@Module({
  providers: [PrismaService, OutboxDispatcher],
  exports: [PrismaService, OutboxDispatcher],
})
export class SharedModule {}
