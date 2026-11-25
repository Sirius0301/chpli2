import { Inject, Injectable } from '@nestjs/common';
import type { Memo, MemoCompletion } from '@prisma/client';
import type {
  CreateMemoDto,
  MemoDto,
  MemoPriority,
  SetMemoCompletionDto,
  TagCountDto,
  UpdateMemoDto,
} from '@chpli2/shared';
import {
  ERROR_CODES,
  MEMO_PRIORITIES,
  MEMO_REPEAT_ALL,
  MEMO_TAG_MAX_LENGTH,
  MEMO_TAGS_MAX_COUNT,
  MEMO_TITLE_MAX_LENGTH,
  expandMemoToRange,
  isDateKey,
  type MemoRepeatRule,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';

function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface MemoFilters {
  /** AND semantics: the memo must carry every listed tag (M2). */
  tags?: string[];
  /** OR semantics: the memo priority must be one of the listed values (M2). */
  priorities?: MemoPriority[];
}

@Injectable()
export class MemoService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Lists the user's raw memos (no repeat expansion, M1 D2) whose recurrence
   * window intersects [from, to): non-repeating memos need date in range;
   * repeating memos start before `to` and either never end or end at/after
   * `from`.
   */
  async list(userId: string, from: string, to: string, filters: MemoFilters = {}): Promise<MemoDto[]> {
    const fromDate = this.parseDateKey(from, 'from');
    const toDate = this.parseDateKey(to, 'to');
    if (toDate <= fromDate) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'to must be after from');
    }
    const rows = await this.prisma.memo.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { lte: toDate },
        ...(filters.tags?.length ? { tags: { hasEvery: filters.tags } } : {}),
        ...(filters.priorities?.length ? { priority: { in: filters.priorities } } : {}),
        OR: [
          { repeat: 'none', date: { gte: fromDate } },
          {
            repeat: { not: 'none' },
            OR: [{ repeatEnd: null }, { repeatEnd: { gte: fromDate } }],
          },
        ],
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: { completions: true },
    });
    return rows.map((row) => this.toDto(row, row.completions));
  }

  /**
   * Tag aggregate across ALL of the user's active memos (not the view
   * window), so the filter-sidebar candidates never shrink under filtering
   * (M2 D5). Sorted by count desc, tag asc.
   */
  async tagCounts(userId: string): Promise<TagCountDto[]> {
    const rows = await this.prisma.memo.findMany({
      where: { userId, deletedAt: null },
      select: { tags: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /**
   * Renames a tag across ALL of the user's active memos (sidebar tag
   * management). Renaming onto an existing tag merges them (dedupe keeps
   * the per-memo tag count within the cap). Returns fresh tag counts.
   */
  async renameTag(userId: string, from: string, to: string): Promise<TagCountDto[]> {
    const source = from.trim();
    const target = to.trim();
    if (!source || !target || source.length > MEMO_TAG_MAX_LENGTH || target.length > MEMO_TAG_MAX_LENGTH) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `tags must be 1..${MEMO_TAG_MAX_LENGTH} characters (E52)`,
      );
    }
    if (source === target) return this.tagCounts(userId);
    const rows = await this.prisma.memo.findMany({
      where: { userId, deletedAt: null, tags: { has: source } },
      select: { id: true, tags: true },
    });
    for (const row of rows) {
      const next = [...new Set(row.tags.map((tag) => (tag === source ? target : tag)))];
      await this.prisma.memo.update({ where: { id: row.id }, data: { tags: next } });
    }
    return this.tagCounts(userId);
  }

  /** Removes a tag from ALL of the user's active memos. Returns fresh tag counts. */
  async removeTag(userId: string, tag: string): Promise<TagCountDto[]> {
    const rows = await this.prisma.memo.findMany({
      where: { userId, deletedAt: null, tags: { has: tag } },
      select: { id: true, tags: true },
    });
    for (const row of rows) {
      await this.prisma.memo.update({
        where: { id: row.id },
        data: { tags: row.tags.filter((existing) => existing !== tag) },
      });
    }
    return this.tagCounts(userId);
  }

  /** Idempotent create on the client-generated id (E47, same semantics as E11). */
  async create(userId: string, body: CreateMemoDto): Promise<MemoDto> {
    const existing = await this.prisma.memo.findUnique({ where: { id: body.id } });
    if (existing) {
      const completions = await this.prisma.memoCompletion.findMany({
        where: { memoId: existing.id },
      });
      return this.toDto(existing, completions);
    }
    const title = body.title.trim();
    this.validateTitle(title);
    const date = this.parseDateKey(body.date, 'date');
    const repeat = this.normalizeRepeat(body.repeat ?? 'none');
    const repeatEnd = this.normalizeRepeatEnd(body.repeatEnd ?? null, repeat, date);
    const repeatDays = this.normalizeRepeatDays(body.repeatDays, repeat);
    const priority = this.normalizePriority(body.priority ?? 'none');
    const tags = this.normalizeTags(body.tags ?? []);

    const memo = await this.prisma.memo.create({
      data: {
        id: body.id,
        userId,
        title,
        date,
        priority,
        note: body.note?.trim() ? body.note.trim() : null,
        repeat,
        repeatEnd,
        repeatDays,
        tags,
      },
    });
    return this.toDto(memo, []);
  }

  async get(userId: string, id: string): Promise<MemoDto> {
    const { memo, completions } = await this.requireMemo(userId, id);
    return this.toDto(memo, completions);
  }

  async update(userId: string, id: string, body: UpdateMemoDto): Promise<MemoDto> {
    const { memo, completions } = await this.requireMemo(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'updatedAt must be a valid ISO 8601 datetime',
        );
      }
      if (clientVersion.getTime() !== memo.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the memo was modified elsewhere; reload before saving',
        );
      }
    }
    if (body.title !== undefined) {
      const trimmed = body.title.trim();
      this.validateTitle(trimmed);
    }

    const date = body.date !== undefined ? this.parseDateKey(body.date, 'date') : memo.date;
    const repeat: MemoRepeatRule = body.repeat ?? (memo.repeat as MemoRepeatRule);
    this.normalizeRepeat(repeat);
    const repeatEnd = this.normalizeRepeatEnd(
      body.repeatEnd !== undefined ? body.repeatEnd : memo.repeatEnd ? dateToKey(memo.repeatEnd) : null,
      repeat,
      date,
    );
    const repeatDays = this.normalizeRepeatDays(
      body.repeatDays !== undefined ? body.repeatDays : memo.repeatDays,
      repeat,
    );

    const updated = await this.prisma.memo.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title.trim() : memo.title,
        date,
        priority: body.priority !== undefined ? this.normalizePriority(body.priority) : memo.priority,
        note:
          body.note !== undefined
            ? body.note?.trim()
              ? body.note.trim()
              : null
            : memo.note,
        repeat,
        repeatEnd,
        repeatDays,
        tags: body.tags !== undefined ? this.normalizeTags(body.tags) : memo.tags,
      },
    });
    return this.toDto(updated, completions);
  }

  /** Soft-deletes the memo; its completions cascade (FK). */
  async remove(userId: string, id: string): Promise<void> {
    await this.requireMemo(userId, id);
    await this.prisma.memo.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Deletes a single instance of a repeating memo by adding its date to
   * `excludedDates` (expansion skips it everywhere). The date must be an
   * actual occurrence (E50 semantics); already-excluded dates are
   * idempotent no-ops.
   */
  async removeInstance(userId: string, id: string, dateKey: string): Promise<MemoDto> {
    const { memo, completions } = await this.requireMemo(userId, id);
    const repeat = memo.repeat as MemoRepeatRule;
    if (repeat === 'none') {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'instance deletion requires a repeating memo',
      );
    }
    this.parseDateKey(dateKey, 'date');
    const excluded = memo.excludedDates.map(dateToKey);
    if (excluded.includes(dateKey)) {
      return this.toDto(memo, completions);
    }
    const occurrences = expandMemoToRange(
      {
        date: dateToKey(memo.date),
        repeat,
        repeatEnd: memo.repeatEnd ? dateToKey(memo.repeatEnd) : null,
        repeatDays: memo.repeatDays,
        excludedDates: excluded,
      },
      dateKey,
      dateKey,
    );
    if (!occurrences.includes(dateKey)) {
      throw unprocessableException(
        ERROR_CODES.MEMO_DATE_NOT_INSTANCE,
        'date is not an occurrence of this memo repeat rule (E50)',
      );
    }
    const updated = await this.prisma.memo.update({
      where: { id },
      data: { excludedDates: [...excluded, dateKey].sort().map(keyToUtcDate) },
    });
    return this.toDto(updated, completions);
  }

  /**
   * Toggles completion. Non-repeating: sets/clears `completedAt` and the
   * date must equal the memo's date (E51). Repeating: upserts/removes a
   * MemoCompletion row for the instance date, which must be an actual
   * occurrence of the rule (E50). Past/future instances may be toggled (H3).
   */
  async setCompletion(userId: string, id: string, body: SetMemoCompletionDto): Promise<MemoDto> {
    const { memo, completions } = await this.requireMemo(userId, id);
    const dateKey = body.date;
    const date = this.parseDateKey(dateKey, 'date');
    const repeat = memo.repeat as MemoRepeatRule;

    if (repeat === 'none') {
      if (dateKey !== dateToKey(memo.date)) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'date must equal the memo date for non-repeating memos (E51)',
        );
      }
      const updated = await this.prisma.memo.update({
        where: { id },
        data: { completedAt: body.completed ? new Date() : null },
      });
      return this.toDto(updated, completions);
    }

    const occurrences = expandMemoToRange(
      {
        date: dateToKey(memo.date),
        repeat,
        repeatEnd: memo.repeatEnd ? dateToKey(memo.repeatEnd) : null,
        repeatDays: memo.repeatDays,
        excludedDates: memo.excludedDates.map(dateToKey),
      },
      dateKey,
      dateKey,
    );
    if (!occurrences.includes(dateKey)) {
      throw unprocessableException(
        ERROR_CODES.MEMO_DATE_NOT_INSTANCE,
        'date is not an occurrence of this memo repeat rule (E50)',
      );
    }

    if (body.completed) {
      await this.prisma.memoCompletion.upsert({
        where: { memoId_date: { memoId: id, date: keyToUtcDate(dateKey) } },
        create: { memoId: id, date: keyToUtcDate(dateKey) },
        update: {},
      });
    } else {
      await this.prisma.memoCompletion.deleteMany({
        where: { memoId: id, date: keyToUtcDate(dateKey) },
      });
    }
    const [updated, freshCompletions] = await Promise.all([
      this.prisma.memo.findUniqueOrThrow({ where: { id } }),
      this.prisma.memoCompletion.findMany({ where: { memoId: id } }),
    ]);
    return this.toDto(updated, freshCompletions);
  }

  // -- helpers ---------------------------------------------------------------

  private validateTitle(title: string): void {
    if (!title) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty (E43)');
    }
    if (title.length > MEMO_TITLE_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title exceeds 256 characters');
    }
  }

  private parseDateKey(value: string, field: string): Date {
    if (!isDateKey(value)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `${field} must be a real calendar date (YYYY-MM-DD) (E44)`,
      );
    }
    return keyToUtcDate(value);
  }

  private normalizePriority(value: string): string {
    if (!MEMO_PRIORITIES.includes(value as (typeof MEMO_PRIORITIES)[number])) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'invalid priority (E46)');
    }
    return value;
  }

  private normalizeRepeat(value: string): MemoRepeatRule {
    if (!MEMO_REPEAT_ALL.includes(value as MemoRepeatRule)) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'invalid repeat rule (E46)');
    }
    return value as MemoRepeatRule;
  }

  /** repeatEnd must be a real date at/after the memo date; cleared for `none` (E44/E45). */
  private normalizeRepeatEnd(value: string | null, repeat: MemoRepeatRule, date: Date): Date | null {
    if (repeat === 'none' || value === null) return null;
    const parsed = this.parseDateKey(value, 'repeatEnd');
    if (parsed < date) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'repeatEnd must not be before the memo date (E45)',
      );
    }
    return parsed;
  }

  /**
   * Custom rule: a non-empty set of weekdays (0=Sun…6=Sat), deduped and
   * sorted; other rules store an empty list.
   */
  private normalizeRepeatDays(value: number[] | undefined, repeat: MemoRepeatRule): number[] {
    if (repeat !== 'custom') return [];
    if (!value || value.length === 0) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'repeatDays must be a non-empty list of weekdays for the custom rule (E46)',
      );
    }
    const days = new Set<number>();
    for (const day of value) {
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'repeatDays entries must be weekdays between 0 (Sun) and 6 (Sat) (E46)',
        );
      }
      days.add(day);
    }
    return [...days].sort((a, b) => a - b);
  }

  /** Trims, drops empties, dedupes and caps the tag list (E52). */
  private normalizeTags(value: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of value) {
      const tag = raw.trim();
      if (!tag) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'tags must not be empty (E52)');
      }
      if (tag.length > MEMO_TAG_MAX_LENGTH) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          `tags must be at most ${MEMO_TAG_MAX_LENGTH} characters (E52)`,
        );
      }
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    if (out.length > MEMO_TAGS_MAX_COUNT) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `at most ${MEMO_TAGS_MAX_COUNT} tags per memo (E52)`,
      );
    }
    return out;
  }

  /** Resolves a memo owned by the user; otherwise 404 (M0 D5, E48). */
  private async requireMemo(
    userId: string,
    id: string,
  ): Promise<{ memo: Memo; completions: MemoCompletion[] }> {
    const memo = await this.prisma.memo.findFirst({
      where: { id, userId, deletedAt: null },
      include: { completions: true },
    });
    if (!memo) {
      throw notFoundException(ERROR_CODES.MEMO_NOT_FOUND, 'memo not found');
    }
    const { completions, ...rest } = memo;
    return { memo: rest as Memo, completions };
  }

  toDto(memo: Memo, completions: MemoCompletion[]): MemoDto {
    return {
      id: memo.id,
      title: memo.title,
      date: dateToKey(memo.date),
      priority: memo.priority as MemoDto['priority'],
      note: memo.note,
      repeat: memo.repeat as MemoRepeatRule,
      repeatEnd: memo.repeatEnd ? dateToKey(memo.repeatEnd) : null,
      repeatDays: memo.repeatDays,
      excludedDates: memo.excludedDates.map(dateToKey).sort(),
      completedAt: memo.completedAt ? memo.completedAt.toISOString() : null,
      completions: completions
        .map((c) => dateToKey(c.date))
        .sort()
        // Non-repeating memos keep completion in completedAt only (M1 D3).
        .filter(() => memo.repeat !== 'none'),
      tags: memo.tags,
      createdAt: memo.createdAt.toISOString(),
      updatedAt: memo.updatedAt.toISOString(),
    };
  }
}
