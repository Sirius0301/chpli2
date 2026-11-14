import { Inject, Injectable } from '@nestjs/common';
import type { Review } from '@prisma/client';
import type {
  CreateReviewDto,
  ReviewDto,
  ScheduleNextMemoDto,
  UpdateReviewDto,
} from '@chpli2/shared';
import { ERROR_CODES, REVIEW_TITLE_MAX_LENGTH, isDateKey } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';
import { GrowthLinksService } from './growth-links.service';
import { GoalsService } from './goals.service';
import { MemoService } from '../memo/memo.service';
import { dateKeyOf, normalizeGrowthTitle, parseOptionalDateKey } from './skills.service';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GrowthLinksService) private readonly linksService: GrowthLinksService,
    @Inject(GoalsService) private readonly goalsService: GoalsService,
    @Inject(MemoService) private readonly memoService: MemoService,
  ) {}

  async list(userId: string): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ reviewedAt: 'desc' }],
    });
    return Promise.all(rows.map((row) => this.toDto(userId, row)));
  }

  /** Idempotent create; reviewedAt defaults to today. */
  async create(userId: string, body: CreateReviewDto): Promise<ReviewDto> {
    const existing = await this.prisma.review.findUnique({ where: { id: body.id } });
    if (existing) return this.toDto(userId, existing);

    const title = normalizeGrowthTitle(body.title, 'title', REVIEW_TITLE_MAX_LENGTH);
    const reviewedAt = this.parseReviewedAt(body.reviewedAt ?? todayKey());
    if (body.goalId) await this.goalsService.get(userId, body.goalId);

    const review = await this.prisma.review.create({
      data: {
        id: body.id,
        userId,
        title,
        content: body.content?.trim() ? body.content.trim() : null,
        reviewedAt,
        goalId: body.goalId ?? null,
      },
    });
    return this.toDto(userId, review);
  }

  async get(userId: string, id: string): Promise<ReviewDto> {
    return this.toDto(userId, await this.requireReview(userId, id));
  }

  async update(userId: string, id: string, body: UpdateReviewDto): Promise<ReviewDto> {
    const review = await this.requireReview(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'updatedAt must be a valid ISO 8601 datetime');
      }
      if (clientVersion.getTime() !== review.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the review was modified elsewhere; reload before saving',
        );
      }
    }
    if (body.goalId) await this.goalsService.get(userId, body.goalId);
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        title: body.title !== undefined ? normalizeGrowthTitle(body.title, 'title', REVIEW_TITLE_MAX_LENGTH) : review.title,
        content: body.content !== undefined ? (body.content?.trim() ? body.content.trim() : null) : review.content,
        reviewedAt: body.reviewedAt !== undefined ? this.parseReviewedAt(body.reviewedAt) : review.reviewedAt,
        goalId: body.goalId !== undefined ? body.goalId : review.goalId,
      },
    });
    return this.toDto(userId, updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireReview(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.growthLink.deleteMany({ where: { ownerType: 'review', ownerId: id } });
    });
  }

  // -- links ---------------------------------------------------------------------

  async addLink(userId: string, reviewId: string, body: Parameters<GrowthLinksService['add']>[3]) {
    await this.requireReview(userId, reviewId);
    await this.linksService.add(userId, 'review', reviewId, body);
    return this.get(userId, reviewId);
  }

  async removeLink(userId: string, reviewId: string, linkId: string) {
    await this.requireReview(userId, reviewId);
    await this.linksService.remove(userId, 'review', reviewId, linkId);
    return this.get(userId, reviewId);
  }

  /**
   * Arranges the next review as a Memo through the OWNING module's service
   * (G2 D6). Idempotent via review.nextMemoId: a repeat call returns the
   * existing arrangement instead of creating a duplicate memo.
   */
  async scheduleNextMemo(userId: string, reviewId: string, body: ScheduleNextMemoDto): Promise<ReviewDto> {
    const review = await this.requireReview(userId, reviewId);
    const date = parseOptionalDateKey(body.date, 'date');
    if (!date) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'date is required (E104)');
    }
    const today = parseOptionalDateKey(todayKey(), 'date')!;
    if (date.getTime() < today.getTime()) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'date must be today or later (E104)');
    }

    let memoId = review.nextMemoId;
    if (memoId) {
      try {
        await this.memoService.get(userId, memoId);
        return this.get(userId, reviewId); // already arranged (E108)
      } catch {
        // Dangling nextMemoId (memo deleted): re-arrange with a fresh memo id.
        memoId = crypto.randomUUID();
        await this.prisma.review.update({
          where: { id: reviewId },
          data: { nextMemoId: memoId },
        });
      }
    } else {
      // Reserve the id before creating so a crash between the two writes
      // still yields a deterministic retry path (the branch above).
      memoId = crypto.randomUUID();
      await this.prisma.review.update({
        where: { id: reviewId },
        data: { nextMemoId: memoId },
      });
    }
    // MemoService.create is idempotent on the client-generated id.
    await this.memoService.create(userId, {
      id: memoId,
      title: `${review.title}（回顾）`,
      date: dateKeyOf(date),
    });
    return this.get(userId, reviewId);
  }

  // -- helpers ---------------------------------------------------------------------

  private parseReviewedAt(value: string): Date {
    if (!isDateKey(value)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'reviewedAt must be a real calendar date (YYYY-MM-DD) (E104)',
      );
    }
    return parseOptionalDateKey(value, 'reviewedAt')!;
  }

  private async requireReview(userId: string, id: string): Promise<Review> {
    const review = await this.prisma.review.findFirst({ where: { id, userId, deletedAt: null } });
    if (!review) {
      throw notFoundException(ERROR_CODES.REVIEW_NOT_FOUND, 'review not found');
    }
    return review;
  }

  private async toDto(userId: string, review: Review): Promise<ReviewDto> {
    const links = await this.linksService.resolveFor(userId, 'review', review.id);
    let goalTitle: string | null = null;
    if (review.goalId) {
      try {
        goalTitle = (await this.goalsService.get(userId, review.goalId)).title;
      } catch {
        goalTitle = null;
      }
    }
    let nextMemoDate: string | null = null;
    if (review.nextMemoId) {
      try {
        nextMemoDate = (await this.memoService.get(userId, review.nextMemoId)).date;
      } catch {
        nextMemoDate = null; // memo deleted: treat as not arranged (E106)
      }
    }
    return {
      id: review.id,
      title: review.title,
      content: review.content,
      reviewedAt: dateKeyOf(review.reviewedAt),
      goalId: review.goalId,
      goalTitle,
      links,
      nextMemoDate,
      nextMemoId: review.nextMemoId,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
