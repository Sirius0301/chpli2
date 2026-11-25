import { Inject, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { NoteImagesService } from './note-images.service';

/** Sweep cadence for due scheduled notes (N3 scheduler). */
export const PUBLISH_SWEEP_MS = 30_000;

@Module({
  controllers: [NotesController],
  providers: [NotesService, NoteImagesService],
  exports: [NotesService],
})
export class NotesModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  // Explicit @Inject: the dev runner (tsx/esbuild) does not emit decorator
  // metadata, so bare constructor params would inject undefined.
  constructor(@Inject(NotesService) private readonly notes: NotesService) {}

  /**
   * In-process scheduler: flips scheduled notes to published once their
   * time passes. A missed window is caught by the next sweep after restart
   * (publishDue is idempotent and backlog-safe), so no external cron is
   * required at this scale.
   */
  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      this.notes.publishDue().catch(() => {
        /* next sweep retries; scheduling must never crash the API */
      });
    }, PUBLISH_SWEEP_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
