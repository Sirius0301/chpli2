import { Inject, Injectable } from '@nestjs/common';
import type { Goal, GoalLink, Milestone } from '@prisma/client';
import type {
  AddGoalLinkDto,
  CreateGoalDto,
  CreateMilestoneDto,
  GoalDto,
  GoalLinkDto,
  GoalLinkModule,
  GoalStatus,
  MilestoneDto,
  UpdateGoalDto,
  UpdateMilestoneDto,
} from '@chpli2/shared';
import {
  ERROR_CODES,
  GOAL_LINK_MODULES,
  GOAL_STATUSES,
  GOAL_TITLE_MAX_LENGTH,
  computeGoalProgress,
  isDateKey,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';
import { NotesService } from '../notes/notes.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';

function keyToUtcDate(key: string, field: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Growth & Career G1. Cross-module links (D5) are validated and resolved
 * exclusively through the OWNING modules' services — never direct table
 * access — so notes/bookmarks stay fully decoupled from growth.
 */
@Injectable()
export class GoalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotesService) private readonly notesService: NotesService,
    @Inject(BookmarksService) private readonly bookmarksService: BookmarksService,
  ) {}

  async list(userId: string): Promise<GoalDto[]> {
    const rows = await this.prisma.goal.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ updatedAt: 'desc' }],
      include: { milestones: true, links: true },
    });
    return Promise.all(rows.map((row) => this.toDto(userId, row)));
  }

  /** Idempotent create on the client-generated id. */
  async create(userId: string, body: CreateGoalDto): Promise<GoalDto> {
    const existing = await this.prisma.goal.findUnique({ where: { id: body.id } });
    if (existing) return this.toDto(userId, await this.loadFull(existing.id));

    const goal = await this.prisma.goal.create({
      data: {
        id: body.id,
        userId,
        title: this.normalizeTitle(body.title),
        description: this.normalizeDescription(body.description ?? null),
        status: this.normalizeStatus(body.status ?? 'active'),
        targetDate: this.parseDateKey(body.targetDate ?? null, 'targetDate'),
      },
      include: { milestones: true, links: true },
    });
    return this.toDto(userId, goal);
  }

  async get(userId: string, id: string): Promise<GoalDto> {
    await this.requireGoal(userId, id);
    return this.toDto(userId, await this.loadFull(id));
  }

  async update(userId: string, id: string, body: UpdateGoalDto): Promise<GoalDto> {
    const goal = await this.requireGoal(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'updatedAt must be a valid ISO 8601 datetime',
        );
      }
      if (clientVersion.getTime() !== goal.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the goal was modified elsewhere; reload before saving',
        );
      }
    }
    await this.prisma.goal.update({
      where: { id },
      data: {
        title: body.title !== undefined ? this.normalizeTitle(body.title) : goal.title,
        description:
          body.description !== undefined
            ? this.normalizeDescription(body.description)
            : goal.description,
        status: body.status !== undefined ? this.normalizeStatus(body.status) : goal.status,
        targetDate:
          body.targetDate !== undefined
            ? this.parseDateKey(body.targetDate, 'targetDate')
            : goal.targetDate,
      },
    });
    return this.toDto(userId, await this.loadFull(id));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireGoal(userId, id);
    await this.prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // -- Milestones --------------------------------------------------------------

  async addMilestone(
    userId: string,
    goalId: string,
    body: CreateMilestoneDto,
  ): Promise<GoalDto> {
    await this.requireGoal(userId, goalId);
    const existing = await this.prisma.milestone.findUnique({ where: { id: body.id } });
    if (!existing) {
      await this.prisma.milestone.create({
        data: {
          id: body.id,
          goalId,
          title: this.normalizeTitle(body.title),
          date: this.parseDateKey(body.date ?? null, 'date'),
        },
      });
    }
    return this.toDto(userId, await this.loadFull(goalId));
  }

  async updateMilestone(
    userId: string,
    goalId: string,
    milestoneId: string,
    body: UpdateMilestoneDto,
  ): Promise<GoalDto> {
    await this.requireGoal(userId, goalId);
    const milestone = await this.requireMilestone(goalId, milestoneId);
    const status = body.status ?? (milestone.status as 'open' | 'done');
    await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        title: body.title !== undefined ? this.normalizeTitle(body.title) : milestone.title,
        date: body.date !== undefined ? this.parseDateKey(body.date, 'date') : milestone.date,
        status,
        // done records when; reopening clears it
        completedAt:
          status === 'done' ? (milestone.completedAt ?? new Date()) : null,
      },
    });
    return this.toDto(userId, await this.loadFull(goalId));
  }

  async removeMilestone(userId: string, goalId: string, milestoneId: string): Promise<GoalDto> {
    await this.requireGoal(userId, goalId);
    await this.requireMilestone(goalId, milestoneId);
    await this.prisma.milestone.delete({ where: { id: milestoneId } });
    return this.toDto(userId, await this.loadFull(goalId));
  }

  // -- Cross-module links (G1 D5) ------------------------------------------------

  /**
   * Adds a link after validating ownership through the OWNING module's
   * service. Idempotent via @@unique(goalId, module, refId) (E100); a
   * missing/invisible target is a 404 (E99).
   */
  async addLink(userId: string, goalId: string, body: AddGoalLinkDto): Promise<GoalDto> {
    await this.requireGoal(userId, goalId);
    if (!(GOAL_LINK_MODULES as readonly string[]).includes(body.module)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `module must be one of ${GOAL_LINK_MODULES.join(', ')} (E96)`,
      );
    }
    await this.resolveLinkTarget(userId, body.module, body.refId); // 404 when invisible

    await this.prisma.goalLink.upsert({
      where: {
        goalId_module_refId: { goalId, module: body.module, refId: body.refId },
      },
      create: { goalId, module: body.module, refId: body.refId },
      update: {},
    });
    return this.toDto(userId, await this.loadFull(goalId));
  }

  async removeLink(userId: string, goalId: string, linkId: string): Promise<GoalDto> {
    await this.requireGoal(userId, goalId);
    const link = await this.prisma.goalLink.findFirst({ where: { id: linkId, goalId } });
    if (!link) {
      throw notFoundException(ERROR_CODES.GOAL_NOT_FOUND, 'link not found');
    }
    await this.prisma.goalLink.delete({ where: { id: linkId } });
    return this.toDto(userId, await this.loadFull(goalId));
  }

  /** Validates visibility and resolves the display title via the owner service. */
  private async resolveLinkTarget(
    userId: string,
    module: GoalLinkModule,
    refId: string,
  ): Promise<string> {
    try {
      if (module === 'notes') {
        return (await this.notesService.get(userId, refId)).title;
      }
      return (await this.bookmarksService.get(userId, refId)).title;
    } catch {
      throw notFoundException(
        ERROR_CODES.GOAL_NOT_FOUND,
        'link target not found or not visible (E99)',
      );
    }
  }

  // -- helpers ---------------------------------------------------------------------

  private normalizeTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty');
    }
    if (trimmed.length > GOAL_TITLE_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title exceeds 256 characters');
    }
    return trimmed;
  }

  private normalizeDescription(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private normalizeStatus(value: string): GoalStatus {
    if (!(GOAL_STATUSES as readonly string[]).includes(value)) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'invalid goal status (E96)');
    }
    return value as GoalStatus;
  }

  private parseDateKey(value: string | null, field: string): Date | null {
    if (value === null) return null;
    if (!isDateKey(value)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `${field} must be a real calendar date (YYYY-MM-DD) (E97)`,
      );
    }
    return keyToUtcDate(value, field);
  }

  private async requireGoal(userId: string, id: string): Promise<Goal> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!goal) {
      throw notFoundException(ERROR_CODES.GOAL_NOT_FOUND, 'goal not found');
    }
    return goal;
  }

  private async requireMilestone(goalId: string, milestoneId: string): Promise<Milestone> {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, goalId },
    });
    if (!milestone) {
      throw notFoundException(ERROR_CODES.GOAL_NOT_FOUND, 'milestone not found');
    }
    return milestone;
  }

  private async loadFull(id: string) {
    return this.prisma.goal.findUniqueOrThrow({
      where: { id },
      include: { milestones: true, links: true },
    });
  }

  /** Maps a full goal row; dangling links are omitted (D5). */
  private async toDto(
    userId: string,
    goal: Goal & { milestones: Milestone[]; links: GoalLink[] },
  ): Promise<GoalDto> {
    const links: GoalLinkDto[] = [];
    for (const link of goal.links) {
      try {
        const title = await this.resolveLinkTarget(
          userId,
          link.module as GoalLinkModule,
          link.refId,
        );
        links.push({
          id: link.id,
          module: link.module as GoalLinkModule,
          refId: link.refId,
          title,
          createdAt: link.createdAt.toISOString(),
        });
      } catch {
        /* dangling link: target deleted — omit from the DTO (D5) */
      }
    }
    const milestones = [...goal.milestones].sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return -1;
      if (b.date) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      status: goal.status as GoalStatus,
      targetDate: goal.targetDate ? dateToKey(goal.targetDate) : null,
      progress: computeGoalProgress(goal.milestones),
      milestones: milestones.map((m) => this.toMilestoneDto(m)),
      links,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  toMilestoneDto(milestone: Milestone): MilestoneDto {
    return {
      id: milestone.id,
      goalId: milestone.goalId,
      title: milestone.title,
      date: milestone.date ? dateToKey(milestone.date) : null,
      status: milestone.status as MilestoneDto['status'],
      completedAt: milestone.completedAt ? milestone.completedAt.toISOString() : null,
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
    };
  }
}
