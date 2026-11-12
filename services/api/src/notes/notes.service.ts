import { Inject, Injectable } from '@nestjs/common';
import type { Note } from '@prisma/client';
import type {
  CreateNoteDto,
  NoteDto,
  NotePriority,
  TagCountDto,
  UpdateNoteDto,
} from '@chpli2/shared';
import {
  ERROR_CODES,
  MEMO_PRIORITIES,
  MEMO_TAG_MAX_LENGTH,
  MEMO_TAGS_MAX_COUNT,
  NOTE_BODY_MAX_BYTES,
  NOTE_TITLE_MAX_LENGTH,
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
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row));
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

    const note = await this.prisma.note.create({
      data: {
        id: body.id,
        userId,
        title: this.normalizeTitle(body.title),
        body: this.normalizeBody(body.body ?? ''),
        priority: this.normalizePriority(body.priority ?? 'none'),
        tags: this.normalizeTags(body.tags ?? []),
      },
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
    const updated = await this.prisma.note.update({
      where: { id },
      data: {
        title: body.title !== undefined ? this.normalizeTitle(body.title) : note.title,
        body: body.body !== undefined ? this.normalizeBody(body.body) : note.body,
        priority:
          body.priority !== undefined ? this.normalizePriority(body.priority) : note.priority,
        tags: body.tags !== undefined ? this.normalizeTags(body.tags) : note.tags,
      },
    });
    return this.toDto(updated);
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
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}
