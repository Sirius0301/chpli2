import type { DateKey } from './memo.js';

/**
 * Growth & Career (G1) contract: goals + milestones + derived progress +
 * cross-module links (notes/bookmarks).
 */

export const GOAL_TITLE_MAX_LENGTH = 256;

export const GOAL_STATUSES = ['active', 'paused', 'achieved', 'archived'] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Link target modules supported in G1 (D1). */
export const GOAL_LINK_MODULES = ['notes', 'bookmarks'] as const;

export type GoalLinkModule = (typeof GOAL_LINK_MODULES)[number];

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
