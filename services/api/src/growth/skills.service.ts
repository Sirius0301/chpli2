import { Inject, Injectable } from '@nestjs/common';
import type { Skill } from '@prisma/client';
import type { CreateSkillDto, SkillDto, SkillLevel, UpdateSkillDto } from '@chpli2/shared';
import { ERROR_CODES, SKILL_LEVELS, SKILL_NAME_MAX_LENGTH, isDateKey } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  conflictException,
  notFoundException,
  unprocessableException,
} from '../shared/http-error';
import { GrowthLinksService } from './growth-links.service';
import { GoalsService } from './goals.service';

/** Shared title/goal validation helpers for growth entities. */
export function normalizeGrowthTitle(
  title: string,
  field: string,
  max: number,
): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, `${field} must not be empty`);
  }
  if (trimmed.length > max) {
    throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, `${field} exceeds ${max} characters`);
  }
  return trimmed;
}

export function parseOptionalDateKey(value: string | null, field: string): Date | null {
  if (value === null) return null;
  if (!isDateKey(value)) {
    throw unprocessableException(
      ERROR_CODES.VALIDATION_ERROR,
      `${field} must be a real calendar date (YYYY-MM-DD)`,
    );
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class SkillsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GrowthLinksService) private readonly linksService: GrowthLinksService,
    @Inject(GoalsService) private readonly goalsService: GoalsService,
  ) {}

  async list(userId: string): Promise<SkillDto[]> {
    const rows = await this.prisma.skill.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ name: 'asc' }],
    });
    return Promise.all(rows.map((row) => this.toDto(userId, row)));
  }

  /** Idempotent create; duplicate names are rejected (E102). */
  async create(userId: string, body: CreateSkillDto): Promise<SkillDto> {
    const existing = await this.prisma.skill.findUnique({ where: { id: body.id } });
    if (existing) return this.toDto(userId, existing);

    const name = normalizeGrowthTitle(body.name, 'name', SKILL_NAME_MAX_LENGTH);
    const level = this.normalizeLevel(body.level ?? 0);
    if (body.goalId) await this.goalsService.get(userId, body.goalId); // 404 (E103)

    try {
      const skill = await this.prisma.skill.create({
        data: { id: body.id, userId, name, level, goalId: body.goalId ?? null },
      });
      return this.toDto(userId, skill);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw conflictException(ERROR_CODES.SKILL_EXISTS, 'a skill with this name already exists (E102)');
      }
      throw error;
    }
  }

  async get(userId: string, id: string): Promise<SkillDto> {
    return this.toDto(userId, await this.requireSkill(userId, id));
  }

  async update(userId: string, id: string, body: UpdateSkillDto): Promise<SkillDto> {
    const skill = await this.requireSkill(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'updatedAt must be a valid ISO 8601 datetime');
      }
      if (clientVersion.getTime() !== skill.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the skill was modified elsewhere; reload before saving',
        );
      }
    }
    if (body.goalId) await this.goalsService.get(userId, body.goalId);
    try {
      const updated = await this.prisma.skill.update({
        where: { id },
        data: {
          name: body.name !== undefined ? normalizeGrowthTitle(body.name, 'name', SKILL_NAME_MAX_LENGTH) : skill.name,
          level: body.level !== undefined ? this.normalizeLevel(body.level) : skill.level,
          goalId: body.goalId !== undefined ? body.goalId : skill.goalId,
        },
      });
      return this.toDto(userId, updated);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw conflictException(ERROR_CODES.SKILL_EXISTS, 'a skill with this name already exists (E102)');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireSkill(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.skill.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.growthLink.deleteMany({ where: { ownerType: 'skill', ownerId: id } });
    });
  }

  // -- links ---------------------------------------------------------------------

  async addLink(userId: string, skillId: string, body: Parameters<GrowthLinksService['add']>[3]) {
    await this.requireSkill(userId, skillId);
    await this.linksService.add(userId, 'skill', skillId, body);
    return this.get(userId, skillId);
  }

  async removeLink(userId: string, skillId: string, linkId: string) {
    await this.requireSkill(userId, skillId);
    await this.linksService.remove(userId, 'skill', skillId, linkId);
    return this.get(userId, skillId);
  }

  // -- helpers ---------------------------------------------------------------------

  private normalizeLevel(value: number): SkillLevel {
    if (!(SKILL_LEVELS as readonly number[]).includes(value)) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, `level must be between 0 and 5 (E102)`);
    }
    return value as SkillLevel;
  }

  private async requireSkill(userId: string, id: string): Promise<Skill> {
    const skill = await this.prisma.skill.findFirst({ where: { id, userId, deletedAt: null } });
    if (!skill) {
      throw notFoundException(ERROR_CODES.SKILL_NOT_FOUND, 'skill not found');
    }
    return skill;
  }

  private async toDto(userId: string, skill: Skill): Promise<SkillDto> {
    const links = await this.linksService.resolveFor(userId, 'skill', skill.id);
    let goalTitle: string | null = null;
    if (skill.goalId) {
      try {
        goalTitle = (await this.goalsService.get(userId, skill.goalId)).title;
      } catch {
        goalTitle = null; // goal deleted: SetNull keeps the row consistent
      }
    }
    return {
      id: skill.id,
      name: skill.name,
      level: skill.level as SkillDto['level'],
      goalId: skill.goalId,
      goalTitle,
      links,
      createdAt: skill.createdAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString(),
    };
  }
}
