import type { DateKey } from './memo.js';

/**
 * Growth & Career (G1) contract: goals + milestones + derived progress +
 * cross-module links (notes/bookmarks).
 */

export const GOAL_TITLE_MAX_LENGTH = 256;

export const GOAL_STATUSES = ['active', 'paused', 'achieved', 'archived'] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Link target modules supported by the growth module (G1: notes/bookmarks; G2 adds memos). */
export const GOAL_LINK_MODULES = ['notes', 'bookmarks', 'memos'] as const;

export type GoalLinkModule = (typeof GOAL_LINK_MODULES)[number];

/** Link owner kinds in the unified growth_links table (G2 D3). */
export const GROWTH_LINK_OWNERS = ['goal', 'skill', 'review'] as const;

export type GrowthLinkOwner = (typeof GROWTH_LINK_OWNERS)[number];

export interface MilestoneDto {
  id: string;
  goalId: string;
  title: string;
  /** Planned date (pure date, YYYY-MM-DD) or null. */
  date: DateKey | null;
  status: 'open' | 'done';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A cross-module link with its resolved display title (D5). */
export interface GoalLinkDto {
  id: string;
  module: GoalLinkModule;
  refId: string;
  title: string;
  createdAt: string;
}

export interface GoalDto {
  id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  /** Pure date (YYYY-MM-DD) or null (D4). */
  targetDate: DateKey | null;
  /** Derived from milestones (D2): done/total, 0 when no milestones. */
  progress: number;
  milestones: MilestoneDto[];
  links: GoalLinkDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalDto {
  /** Client-generated UUID, submitted for idempotent create. */
  id: string;
  title: string;
  description?: string | null;
  status?: GoalStatus;
  targetDate?: DateKey | null;
}

export interface UpdateGoalDto {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  targetDate?: DateKey | null;
  /** Current updatedAt of the goal being edited; mismatch -> 409. */
  updatedAt?: string;
}

export interface CreateMilestoneDto {
  /** Client-generated UUID, submitted for idempotent create. */
  id: string;
  title: string;
  /** Pure date (YYYY-MM-DD) or null. */
  date?: DateKey | null;
}

export interface UpdateMilestoneDto {
  title?: string;
  date?: DateKey | null;
  status?: 'open' | 'done';
}

export interface AddGoalLinkDto {
  module: GoalLinkModule;
  refId: string;
}

/** Derived progress (D2): 0 when there are no milestones. */
export function computeGoalProgress(milestones: { status: string }[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.status === 'done').length;
  return Math.round((done / milestones.length) * 100);
}

// ---------------------------------------------------------------------------
// Skills (G2)
// ---------------------------------------------------------------------------

export const SKILL_NAME_MAX_LENGTH = 128;

/** Proficiency scale (G2 D2): 0 = unevaluated, 1..5 = aware..expert. */
export const SKILL_LEVELS = [0, 1, 2, 3, 4, 5] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export interface SkillDto {
  id: string;
  name: string;
  level: SkillLevel;
  /** Optional owning goal (null = standalone, G2 D1). */
  goalId: string | null;
  goalTitle: string | null;
  links: GoalLinkDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillDto {
  /** Client-generated UUID, submitted for idempotent create. */
  id: string;
  name: string;
  level?: SkillLevel;
  goalId?: string | null;
}

export interface UpdateSkillDto {
  name?: string;
  level?: SkillLevel;
  goalId?: string | null;
  /** Current updatedAt of the skill being edited; mismatch -> 409. */
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Reviews (G2)
// ---------------------------------------------------------------------------

export const REVIEW_TITLE_MAX_LENGTH = 256;

export interface ReviewDto {
  id: string;
  title: string;
  content: string | null;
  /** Pure date (YYYY-MM-DD); defaults to today at creation. */
  reviewedAt: string;
  /** Optional owning goal (null = career-wide). */
  goalId: string | null;
  goalTitle: string | null;
  links: GoalLinkDto[];
  /** Date of the scheduled next-review memo (null when not arranged, D6). */
  nextMemoDate: string | null;
  nextMemoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewDto {
  /** Client-generated UUID, submitted for idempotent create. */
  id: string;
  title: string;
  content?: string | null;
  reviewedAt?: string;
  goalId?: string | null;
}

export interface UpdateReviewDto {
  title?: string;
  content?: string | null;
  reviewedAt?: string;
  goalId?: string | null;
  /** Current updatedAt of the review being edited; mismatch -> 409. */
  updatedAt?: string;
}

export interface ScheduleNextMemoDto {
  /** Pure date (YYYY-MM-DD), today or later (G2 D6). */
  date: string;
}
