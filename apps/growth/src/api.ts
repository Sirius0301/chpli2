import type {
  ApiErrorBody,
  GoalDto,
  CreateGoalDto,
  UpdateGoalDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  AddGoalLinkDto,
  NoteSummaryDto,
  BookmarkDto,
  SkillDto,
  CreateSkillDto,
  UpdateSkillDto,
  ReviewDto,
  CreateReviewDto,
  UpdateReviewDto,
  ScheduleNextMemoDto,
} from '@chpli2/shared';
import { authFetchHeaders, handleAuthFailure } from '@chpli2/shared';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    handleAuthFailure(response.status);
    let errorCode = 'UNKNOWN';
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      errorCode = typeof body.errorCode === 'string' ? body.errorCode : errorCode;
      message = typeof body.message === 'string' ? body.message : message;
    } catch {
      /* body was not JSON; keep defaults */
    }
    throw new ApiError(response.status, errorCode, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: authFetchHeaders(init?.headers as Record<string, string> | undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  return handleResponse<T>(response);
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// -- Goals ---------------------------------------------------------------------

export function listGoals(): Promise<GoalDto[]> {
  return request('/api/goals');
}

export function createGoal(body: CreateGoalDto): Promise<GoalDto> {
  return request('/api/goals', json('POST', body));
}

export function updateGoal(id: string, body: UpdateGoalDto): Promise<GoalDto> {
  return request(`/api/goals/${id}`, json('PATCH', body));
}

export function deleteGoal(id: string): Promise<void> {
  return request(`/api/goals/${id}`, { method: 'DELETE' });
}

export function addMilestone(goalId: string, body: CreateMilestoneDto): Promise<GoalDto> {
  return request(`/api/goals/${goalId}/milestones`, json('POST', body));
}

export function updateMilestone(
  goalId: string,
  milestoneId: string,
  body: UpdateMilestoneDto,
): Promise<GoalDto> {
  return request(`/api/goals/${goalId}/milestones/${milestoneId}`, json('PATCH', body));
}

export function removeMilestone(goalId: string, milestoneId: string): Promise<GoalDto> {
  return request(`/api/goals/${goalId}/milestones/${milestoneId}`, { method: 'DELETE' });
}

export function addLink(goalId: string, body: AddGoalLinkDto): Promise<GoalDto> {
  return request(`/api/goals/${goalId}/links`, json('PUT', body));
}

export function removeLink(goalId: string, linkId: string): Promise<GoalDto> {
  return request(`/api/goals/${goalId}/links/${linkId}`, { method: 'DELETE' });
}

/** Candidates for the link pickers (owning modules' lists). */
export function listNoteCandidates(): Promise<NoteSummaryDto[]> {
  return request('/api/notes');
}

export function listBookmarkCandidates(): Promise<BookmarkDto[]> {
  return request('/api/bookmarks');
}

// -- Skills (G2) -----------------------------------------------------------------

export function listSkills(): Promise<SkillDto[]> {
  return request('/api/skills');
}

export function createSkill(body: CreateSkillDto): Promise<SkillDto> {
  return request('/api/skills', json('POST', body));
}

export function updateSkill(id: string, body: UpdateSkillDto): Promise<SkillDto> {
  return request(`/api/skills/${id}`, json('PATCH', body));
}

export function deleteSkill(id: string): Promise<void> {
  return request(`/api/skills/${id}`, { method: 'DELETE' });
}

export function addSkillLink(skillId: string, body: AddGoalLinkDto): Promise<SkillDto> {
  return request(`/api/skills/${skillId}/links`, json('PUT', body));
}

export function removeSkillLink(skillId: string, linkId: string): Promise<SkillDto> {
  return request(`/api/skills/${skillId}/links/${linkId}`, { method: 'DELETE' });
}

// -- Reviews (G2) ------------------------------------------------------------------

export function listReviews(): Promise<ReviewDto[]> {
  return request('/api/reviews');
}

export function createReview(body: CreateReviewDto): Promise<ReviewDto> {
  return request('/api/reviews', json('POST', body));
}

export function updateReview(id: string, body: UpdateReviewDto): Promise<ReviewDto> {
  return request(`/api/reviews/${id}`, json('PATCH', body));
}

export function deleteReview(id: string): Promise<void> {
  return request(`/api/reviews/${id}`, { method: 'DELETE' });
}

export function addReviewLink(reviewId: string, body: AddGoalLinkDto): Promise<ReviewDto> {
  return request(`/api/reviews/${reviewId}/links`, json('PUT', body));
}

export function removeReviewLink(reviewId: string, linkId: string): Promise<ReviewDto> {
  return request(`/api/reviews/${reviewId}/links/${linkId}`, { method: 'DELETE' });
}

export function scheduleNextMemo(reviewId: string, body: ScheduleNextMemoDto): Promise<ReviewDto> {
  return request(`/api/reviews/${reviewId}/schedule-next-memo`, json('POST', body));
}

/** Memo candidates for the review link picker (calendar module data, read-only). */
export function listMemoCandidates(from: string, to: string): Promise<{ id: string; title: string; date: string }[]> {
  const params = new URLSearchParams({ from, to });
  return request(`/api/memos?${params.toString()}`);
}
