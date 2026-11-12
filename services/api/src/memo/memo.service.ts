import { Inject, Injectable } from '@nestjs/common';
import type { Memo, MemoCompletion } from '@prisma/client';
import type {
  CreateMemoDto,
  MemoDto,
  SetMemoCompletionDto,
  UpdateMemoDto,
} from '@chpli2/shared';
import {
  ERROR_CODES,
  MEMO_PRIORITIES,
  MEMO_REPEAT_ALL,
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

@Injectable()
export class MemoService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Lists the user's raw memos (no repeat expansion, M1 D2) whose recurrence
   * window intersects [from, to): non-repeating memos need date in range;
   * repeating memos start before `to` and either never end or end at/after
   * `from`.
   */
  async list(userId: string, from: string, to: string): Promise<MemoDto[]> {
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
    const priority = this.normalizePriority(body.priority ?? 'none');

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
      { date: dateToKey(memo.date), repeat, repeatEnd: memo.repeatEnd ? dateToKey(memo.repeatEnd) : null },
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
      completedAt: memo.completedAt ? memo.completedAt.toISOString() : null,
      completions: completions
        .map((c) => dateToKey(c.date))
        .sort()
        // Non-repeating memos keep completion in completedAt only (M1 D3).
        .filter(() => memo.repeat !== 'none'),
      createdAt: memo.createdAt.toISOString(),
      updatedAt: memo.updatedAt.toISOString(),
    };
  }
}
