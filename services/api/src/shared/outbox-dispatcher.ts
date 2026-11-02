import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { OutboxEvent } from '@prisma/client';
import type { TransportEventType } from '@chpli2/shared';
import { PrismaService } from './prisma.service';

export type OutboxHandler = (payload: unknown) => Promise<void>;

const POLL_INTERVAL_MS = 200;
const BATCH_SIZE = 50;

/**
 * In-process transactional outbox dispatcher. Producers write business rows
 * and OutboxEvent rows in one transaction; this dispatcher polls unprocessed
 * events, invokes the handler registered for each event type and marks the
 * event processed only after the handler succeeds. Delivery is at-least-once;
 * handlers must be idempotent.
 */
@Injectable()
export class OutboxDispatcher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly handlers = new Map<string, OutboxHandler>();
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  register(type: TransportEventType | string, handler: OutboxHandler): void {
    this.handlers.set(type, handler);
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // Do not keep the Node process alive only because of the poller.
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Visible for testing: runs one poll cycle. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { processedAt: null },
        orderBy: { occurredAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const event of events) {
        await this.dispatch(event);
      }
    } catch (error) {
      // Leave events unprocessed; they will be retried on the next tick.
      this.logger.warn(`outbox poll failed: ${String(error)}`);
    } finally {
      this.ticking = false;
    }
  }

  private async dispatch(event: OutboxEvent): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      this.logger.warn(`no handler for outbox event type ${event.type}; skipping`);
      await this.markProcessed(event.id);
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(event.payload);
    } catch {
      this.logger.error(`outbox event ${event.id} has invalid JSON payload`);
      await this.markProcessed(event.id);
      return;
    }
    await handler(payload);
    await this.markProcessed(event.id);
  }

  private async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }
}
