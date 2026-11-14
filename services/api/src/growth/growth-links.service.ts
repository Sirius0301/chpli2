import { Inject, Injectable } from '@nestjs/common';
import type { GrowthLink } from '@prisma/client';
import type { AddGoalLinkDto, GoalLinkDto, GoalLinkModule, GrowthLinkOwner } from '@chpli2/shared';
import { ERROR_CODES, GOAL_LINK_MODULES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { notFoundException, unprocessableException } from '../shared/http-error';
import { NotesService } from '../notes/notes.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { MemoService } from '../memo/memo.service';

/**
 * Unified cross-module links (G2 D3): growth_links(ownerType, ownerId,
 * module, refId). Ownership checks and title resolution go exclusively
 * through the OWNING modules' services — never direct table access.
 * Dangling links (target deleted) are omitted from DTOs (G1 D5 semantics).
 */
@Injectable()
export class GrowthLinksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotesService) private readonly notesService: NotesService,
    @Inject(BookmarksService) private readonly bookmarksService: BookmarksService,
    @Inject(MemoService) private readonly memoService: MemoService,
  ) {}

  /** Validates the module whitelist and target visibility; idempotent upsert. */
  async add(
    userId: string,
    ownerType: GrowthLinkOwner,
    ownerId: string,
    body: AddGoalLinkDto,
  ): Promise<void> {
    if (!(GOAL_LINK_MODULES as readonly string[]).includes(body.module)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `module must be one of ${GOAL_LINK_MODULES.join(', ')} (E105)`,
      );
    }
    await this.resolveTitle(userId, body.module, body.refId); // 404 when invisible
    await this.prisma.growthLink.upsert({
      where: {
        ownerType_ownerId_module_refId: {
          ownerType,
          ownerId,
          module: body.module,
          refId: body.refId,
        },
      },
      create: { ownerType, ownerId, module: body.module, refId: body.refId },
      update: {},
    });
  }

  async remove(userId: string, ownerType: GrowthLinkOwner, ownerId: string, linkId: string): Promise<void> {
    const link = await this.prisma.growthLink.findFirst({
      where: { id: linkId, ownerType, ownerId },
    });
    if (!link) {
      throw notFoundException(ERROR_CODES.GOAL_NOT_FOUND, 'link not found');
    }
    await this.prisma.growthLink.delete({ where: { id: linkId } });
    void userId;
  }

  /** Deletes all links of an owner (called in the owner's delete transaction). */
  async deleteAllFor(ownerType: GrowthLinkOwner, ownerId: string): Promise<void> {
    await this.prisma.growthLink.deleteMany({ where: { ownerType, ownerId } });
  }

  /** Resolves a owner's links to DTOs, omitting dangling targets. */
  async resolveFor(userId: string, ownerType: GrowthLinkOwner, ownerId: string): Promise<GoalLinkDto[]> {
    const rows = await this.prisma.growthLink.findMany({
      where: { ownerType, ownerId },
      orderBy: { createdAt: 'asc' },
    });
    const out: GoalLinkDto[] = [];
    for (const row of rows) {
      const resolved = await this.tryResolve(userId, row.module as GoalLinkModule, row.refId);
      if (resolved === null) continue; // dangling: omit (D5)
      out.push({
        id: row.id,
        module: row.module as GoalLinkModule,
        refId: row.refId,
        title: resolved,
        createdAt: row.createdAt.toISOString(),
      });
    }
    return out;
  }

  /** Validates visibility and returns the display title (404 when invisible). */
  async resolveTitle(userId: string, module: GoalLinkModule, refId: string): Promise<string> {
    const title = await this.tryResolve(userId, module, refId);
    if (title === null) {
      throw notFoundException(
        ERROR_CODES.GOAL_NOT_FOUND,
        'link target not found or not visible (E99)',
      );
    }
    return title;
  }

  private async tryResolve(
    userId: string,
    module: GoalLinkModule,
    refId: string,
  ): Promise<string | null> {
    try {
      if (module === 'notes') return (await this.notesService.get(userId, refId)).title;
      if (module === 'bookmarks') return (await this.bookmarksService.get(userId, refId)).title;
      return (await this.memoService.get(userId, refId)).title;
    } catch {
      return null;
    }
  }
}
