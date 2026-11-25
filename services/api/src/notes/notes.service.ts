import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import type { Note, NoteVersion } from '@prisma/client';
import type {
  CreateNoteDto,
  NoteDto,
  NotePriority,
  NotePublishStatus,
  NoteSummaryDto,
  NoteVersionDto,
  TagCountDto,
  UpdateNoteDto,
} from '@chpli2/shared';
import {
  ERROR_CODES,
  MEMO_PRIORITIES,
  MEMO_TAG_MAX_LENGTH,
  MEMO_TAGS_MAX_COUNT,
  NOTE_ACCESS_PASSWORD_MAX_LENGTH,
  NOTE_BODY_MAX_BYTES,
  NOTE_CATEGORY_MAX_LENGTH,
  NOTE_EXCERPT_MAX_LENGTH,
  NOTE_PUBLISH_STATUSES,
  NOTE_TITLE_MAX_LENGTH,
  NOTE_VERSIONS_KEEP,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';

export interface NoteFilters {
  /** AND semantics (Memo M2 pattern). */
  tags?: string[];
  /** OR semantics (Memo M2 pattern). */
  priorities?: NotePriority[];
  /** Full-text search across title/body/tags (N2 D3). */
  q?: string;
}

/** Literal wiki-link token used for backlink lookup (N2 D2). */
export function wikiLinkToken(noteId: string): string {
  return `[[${noteId}]]`;
}

@Injectable()
export class NotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Lists the user's notes, most recently updated first (N1 D7). */
  async list(userId: string, filters: NoteFilters = {}): Promise<NoteDto[]> {
    const rows = await this.prisma.note.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(filters.tags?.length ? { tags: { hasEvery: filters.tags } } : {}),
        ...(filters.priorities?.length ? { priority: { in: filters.priorities } } : {}),
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: 'insensitive' as const } },
                { body: { contains: filters.q, mode: 'insensitive' as const } },
                { tags: { has: filters.q } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Notes whose body links to the given note (N2 D2), latest first. */
  async backlinks(userId: string, noteId: string): Promise<NoteSummaryDto[]> {
    await this.requireNote(userId, noteId);
    const rows = await this.prisma.note.findMany({
      where: {
        userId,
        deletedAt: null,
        id: { not: noteId },
        body: { contains: wikiLinkToken(noteId) },
      },
      select: { id: true, title: true },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows;
  }

  /** Tag aggregate across all of the user's notes (Memo M2 D5 pattern). */
  async tagCounts(userId: string): Promise<TagCountDto[]> {
    const rows = await this.prisma.note.findMany({
      where: { userId, deletedAt: null },
      select: { tags: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /** Idempotent create on the client-generated id (E79, Memo E47 pattern). */
  async create(userId: string, body: CreateNoteDto): Promise<NoteDto> {
    const existing = await this.prisma.note.findUnique({ where: { id: body.id } });
    if (existing) return this.toDto(existing);

    const password = body.accessPassword?.trim();
    const data = {
      title: this.normalizeTitle(body.title),
      body: this.normalizeBody(body.body ?? ''),
      priority: this.normalizePriority(body.priority ?? 'none'),
      tags: this.normalizeTags(body.tags ?? []),
      category: this.normalizeCategory(body.category ?? null),
      excerpt: this.normalizeExcerpt(body.excerpt ?? null),
      allowComments: body.allowComments ?? true,
      pinned: body.pinned ?? false,
      accessPassword: password ? this.hashAccessPassword(password) : null,
      showOnHome: body.showOnHome ?? false,
    };
    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.note.create({ data: { id: body.id, userId, ...data } });
      await this.recordVersion(tx, created, 1);
      return created;
    });
    return this.toDto(note);
  }

  async get(userId: string, id: string): Promise<NoteDto> {
    return this.toDto(await this.requireNote(userId, id));
  }

  async update(userId: string, id: string, body: UpdateNoteDto): Promise<NoteDto> {
    const note = await this.requireNote(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'updatedAt must be a valid ISO 8601 datetime',
        );
      }
      if (clientVersion.getTime() !== note.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the note was modified elsewhere; reload before saving',
        );
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.note.update({
        where: { id },
        data: {
          title: body.title !== undefined ? this.normalizeTitle(body.title) : note.title,
          body: body.body !== undefined ? this.normalizeBody(body.body) : note.body,
          priority:
            body.priority !== undefined ? this.normalizePriority(body.priority) : note.priority,
          tags: body.tags !== undefined ? this.normalizeTags(body.tags) : note.tags,
          category:
            body.category !== undefined ? this.normalizeCategory(body.category) : note.category,
          excerpt:
            body.excerpt !== undefined ? this.normalizeExcerpt(body.excerpt) : note.excerpt,
          allowComments: body.allowComments ?? note.allowComments,
          pinned: body.pinned ?? note.pinned,
          // Password semantics: undefined = unchanged, null = clear,
          // whitespace/'' = keep (the form's "leave as is" value),
          // anything else = set/replace (hashed).
          accessPassword:
            body.accessPassword === undefined
              ? note.accessPassword
              : body.accessPassword === null
                ? null
                : body.accessPassword.trim() === ''
                  ? note.accessPassword
                  : this.hashAccessPassword(body.accessPassword),
          showOnHome: body.showOnHome ?? note.showOnHome,
          // Publish block recomputed only when the client explicitly sends it
          // (the publish-form buttons); plain content autosaves never touch it.
          ...(body.publishStatus !== undefined || body.publishAt !== undefined
            ? this.normalizePublish(
                body.publishStatus ?? (note.publishStatus as NotePublishStatus),
                body.publishAt !== undefined
                  ? body.publishAt
                  : note.publishAt
                    ? note.publishAt.toISOString()
                    : null,
              )
            : {}),
        },
      });
      await this.recordVersion(tx, saved);
      return saved;
    });
    return this.toDto(updated);
  }

  /**
   * Publishes every scheduled note whose time has come (N3 scheduler). Runs
   * on a short interval in NotesModule and is safe to call any time: the
   * UPDATE is conditional on the row still being 'scheduled', so concurrent
   * runs and restarts are idempotent.
   */
  async publishDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.note.findMany({
      where: { publishStatus: 'scheduled', publishAt: { lte: now }, deletedAt: null },
      select: { id: true },
    });
    for (const row of due) {
      await this.prisma.note.updateMany({
        where: { id: row.id, publishStatus: 'scheduled' },
        data: { publishStatus: 'published', publishedAt: now, publishAt: null },
      });
    }
    return due.length;
  }

  // -- Version history (N2 D4/D5) ----------------------------------------------

  /** Version list, newest first. Notes created before N2 simply have none. */
  async versions(userId: string, noteId: string): Promise<NoteVersionDto[]> {
    await this.requireNote(userId, noteId);
    const rows = await this.prisma.noteVersion.findMany({
      where: { noteId },
      orderBy: [{ seq: 'desc' }],
    });
    return rows.map((row) => this.toVersionDto(row));
  }

  /**
   * Restores a version as a NEW revision (N2 D5): the current state is
   * snapshotted first, then the target version's content is written back —
   * history is never rewritten and the operation is fully recoverable.
   */
  async restoreVersion(userId: string, noteId: string, seq: number): Promise<NoteDto> {
    await this.requireNote(userId, noteId);
    const target = await this.prisma.noteVersion.findFirst({ where: { noteId, seq } });
    if (!target) {
      throw notFoundException(ERROR_CODES.NOTE_VERSION_NOT_FOUND, 'note version not found (E83)');
    }
    const restored = await this.prisma.$transaction(async (tx) => {
      const current = await tx.note.findUniqueOrThrow({ where: { id: noteId } });
      await this.recordVersion(tx, current); // snapshot the pre-restore state
      const saved = await tx.note.update({
        where: { id: noteId },
        data: {
          title: target.title,
          body: target.body,
          priority: target.priority,
          tags: target.tags,
        },
      });
      await this.recordVersion(tx, saved); // the restore itself is a revision
      return saved;
    });
    return this.toDto(restored);
  }

  /** Snapshot helper: insert the next seq and prune beyond the keep limit. */
  private async recordVersion(
    tx: Pick<PrismaService, 'noteVersion'>,
    note: Note,
    forcedSeq?: number,
  ): Promise<void> {
    const latest = await tx.noteVersion.findFirst({
      where: { noteId: note.id },
      orderBy: [{ seq: 'desc' }],
      select: { seq: true },
    });
    const seq = forcedSeq ?? latest!.seq + 1;
    await tx.noteVersion.create({
      data: {
        noteId: note.id,
        seq,
        title: note.title,
        body: note.body,
        priority: note.priority,
        tags: note.tags,
      },
    });
    await tx.noteVersion.deleteMany({
      where: {
        noteId: note.id,
        seq: { lt: seq - NOTE_VERSIONS_KEEP + 1 },
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireNote(userId, id);
    await this.prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // -- helpers (Memo patterns reused verbatim) --------------------------------

  private normalizeTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty (E77)');
    }
    if (trimmed.length > NOTE_TITLE_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title exceeds 256 characters');
    }
    return trimmed;
  }

  private normalizeBody(body: string): string {
    if (Buffer.byteLength(body, 'utf8') > NOTE_BODY_MAX_BYTES) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `body exceeds the ${NOTE_BODY_MAX_BYTES}-byte limit (E77)`,
      );
    }
    return body;
  }

  private normalizePriority(value: string): string {
    if (!MEMO_PRIORITIES.includes(value as (typeof MEMO_PRIORITIES)[number])) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'invalid priority (E77)');
    }
    return value;
  }

  /** Empty/whitespace category -> null (uncategorized); <= 32 chars. */
  private normalizeCategory(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > NOTE_CATEGORY_MAX_LENGTH) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `category must be at most ${NOTE_CATEGORY_MAX_LENGTH} characters`,
      );
    }
    return trimmed;
  }

  /** Empty/whitespace excerpt -> null; <= 500 chars. */
  private normalizeExcerpt(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > NOTE_EXCERPT_MAX_LENGTH) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `excerpt must be at most ${NOTE_EXCERPT_MAX_LENGTH} characters`,
      );
    }
    return trimmed;
  }

  /**
   * One-way hash (scrypt + per-note salt). The API never returns the
   * password or the hash — NoteDto carries `hasAccessPassword` only.
   */
  private hashAccessPassword(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'access password must not be empty');
    }
    if (trimmed.length > NOTE_ACCESS_PASSWORD_MAX_LENGTH) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `access password must be at most ${NOTE_ACCESS_PASSWORD_MAX_LENGTH} characters`,
      );
    }
    const salt = randomBytes(16).toString('hex');
    return `scrypt$${salt}$${scryptSync(trimmed, salt, 32).toString('hex')}`;
  }

  /**
   * Publish lifecycle (N3): draft carries no times; published stamps
   * publishedAt and must not carry a schedule; scheduled requires a future
   * publishAt. `previousPublishedAt` is preserved across re-publishes.
   */
  private normalizePublish(
    status: NotePublishStatus,
    publishAt: string | null,
  ): { publishStatus: NotePublishStatus; publishAt: Date | null; publishedAt?: Date } {
    if (!NOTE_PUBLISH_STATUSES.includes(status)) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'invalid publish status');
    }
    if (status === 'draft') {
      return { publishStatus: 'draft', publishAt: null };
    }
    if (status === 'published') {
      if (publishAt !== null) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'publishAt is only allowed for the scheduled status',
        );
      }
      return { publishStatus: 'published', publishAt: null, publishedAt: new Date() };
    }
    if (!publishAt || Number.isNaN(new Date(publishAt).getTime())) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'publishAt must be a valid ISO 8601 datetime for the scheduled status',
      );
    }
    if (new Date(publishAt).getTime() <= Date.now()) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'publishAt must be in the future for the scheduled status',
      );
    }
    return { publishStatus: 'scheduled', publishAt: new Date(publishAt) };
  }

  private normalizeTags(value: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of value) {
      const tag = raw.trim();
      if (!tag) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'tags must not be empty (E77)');
      }
      if (tag.length > MEMO_TAG_MAX_LENGTH) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          `tags must be at most ${MEMO_TAG_MAX_LENGTH} characters (E77)`,
        );
      }
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    if (out.length > MEMO_TAGS_MAX_COUNT) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `at most ${MEMO_TAGS_MAX_COUNT} tags per note (E77)`,
      );
    }
    return out;
  }

  private async requireNote(userId: string, id: string): Promise<Note> {
    const note = await this.prisma.note.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!note) {
      throw notFoundException(ERROR_CODES.NOTE_NOT_FOUND, 'note not found');
    }
    return note;
  }

  toDto(note: Note): NoteDto {
    return {
      id: note.id,
      title: note.title,
      body: note.body,
      priority: note.priority as NoteDto['priority'],
      tags: note.tags,
      category: note.category,
      excerpt: note.excerpt,
      allowComments: note.allowComments,
      pinned: note.pinned,
      hasAccessPassword: note.accessPassword !== null,
      showOnHome: note.showOnHome,
      publishStatus: note.publishStatus as NotePublishStatus,
      publishAt: note.publishAt ? note.publishAt.toISOString() : null,
      publishedAt: note.publishedAt ? note.publishedAt.toISOString() : null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  toVersionDto(version: NoteVersion): NoteVersionDto {
    return {
      seq: version.seq,
      title: version.title,
      body: version.body,
      priority: version.priority as NoteVersionDto['priority'],
      tags: version.tags,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
