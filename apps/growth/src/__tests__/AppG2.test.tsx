import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { GoalDto, ReviewDto, SkillDto } from '@chpli2/shared';

function goal(partial: Partial<GoalDto> & Pick<GoalDto, 'id' | 'title'>): GoalDto {
  return {
    description: null,
    status: 'active',
    targetDate: null,
    progress: 0,
    milestones: [],
    links: [],
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...partial,
  };
}

function skill(partial: Partial<SkillDto> & Pick<SkillDto, 'id' | 'name'>): SkillDto {
  return {
    level: 0,
    goalId: null,
    goalTitle: null,
    links: [],
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...partial,
  };
}

function review(partial: Partial<ReviewDto> & Pick<ReviewDto, 'id' | 'title'>): ReviewDto {
  return {
    content: null,
    reviewedAt: '2026-11-14',
    goalId: null,
    goalTitle: null,
    links: [],
    nextMemoDate: null,
    nextMemoId: null,
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...partial,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface StubOptions {
  goals?: GoalDto[];
  skills?: SkillDto[];
  reviews?: ReviewDto[];
  memos?: { id: string; title: string; date: string }[];
  onCreateSkill?: (body: Record<string, unknown>) => void;
  onSchedule?: (reviewId: string, body: Record<string, unknown>) => void;
}

function stubFetch(options: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/skills') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        options.onCreateSkill?.(body);
        return Promise.resolve(jsonResponse({ ...skill({ id: 's1', name: 'x' }), ...body }, 201));
      }
      if (url.includes('/schedule-next-memo') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        const reviewId = url.split('/reviews/')[1]!.split('/')[0]!;
        options.onSchedule?.(reviewId, body);
        return Promise.resolve(jsonResponse(review({ id: reviewId, title: 'r' }), 201));
      }
      if (url.startsWith('/api/goals')) return Promise.resolve(jsonResponse(options.goals ?? []));
      if (url.startsWith('/api/skills')) return Promise.resolve(jsonResponse(options.skills ?? []));
      if (url.startsWith('/api/reviews')) return Promise.resolve(jsonResponse(options.reviews ?? []));
      if (url.startsWith('/api/memos')) return Promise.resolve(jsonResponse(options.memos ?? []));
      if (url.startsWith('/api/notes') || url.startsWith('/api/bookmarks')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }),
  );
}

beforeEach(async () => {
  try {
    globalThis.localStorage?.clear?.();
    window.sessionStorage?.clear?.();
  } catch {
    /* storage unavailable */
  }
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Growth G2', () => {
  it('renders skills with proficiency dots and owning goal (A102)', async () => {
    stubFetch({
      skills: [skill({ id: 's1', name: '分布式系统', level: 3, goalTitle: '架构师之路' })],
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: '技能' }));
    const page = await screen.findByTestId('skills-page');
    expect(page.textContent).toContain('分布式系统');
    expect(page.textContent).toContain('架构师之路');
    const onDots = page.querySelectorAll('.skill-dot--on').length;
    expect(onDots).toBe(3);
  });

  it('creates a skill with level and optional goal', async () => {
    let created: Record<string, unknown> | undefined;
    stubFetch({ onCreateSkill: (b) => (created = b) });
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: '技能' }));
    fireEvent.click(await screen.findByRole('button', { name: '新建技能' }));
    fireEvent.change(screen.getByPlaceholderText('技能名称'), { target: { value: '  Postgres ' } });
    fireEvent.change(screen.getByLabelText('熟练度'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(created).toBeTruthy());
    expect(created!).toMatchObject({ name: 'Postgres', level: 4, goalId: null });
  });

  it('schedules the next review memo with the chosen date (A105)', async () => {
    let scheduled: Record<string, unknown> | undefined;
    stubFetch({
      reviews: [review({ id: 'r1', title: '月度回顾' })],
      onSchedule: (_id, b) => (scheduled = b),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: '回顾' }));
    const page = await screen.findByTestId('reviews-page');
    fireEvent.click(within(page).getByRole('button', { name: '安排下次回顾' }));
    fireEvent.change(within(page).getByLabelText('下次回顾日期'), {
      target: { value: '2026-12-01' },
    });
    fireEvent.click(within(page).getByRole('button', { name: '安排下次回顾' }));
    await waitFor(() => expect(scheduled).toMatchObject({ date: '2026-12-01' }));
  });

  it('shows an arranged next review instead of the schedule button (E108)', async () => {
    stubFetch({
      reviews: [review({ id: 'r1', title: '已安排的回顾', nextMemoDate: '2026-12-05', nextMemoId: 'm1' })],
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('tab', { name: '回顾' }));
    const page = await screen.findByTestId('reviews-page');
    expect(page.textContent).toContain('已安排 2026-12-05');
    expect(within(page).queryByRole('button', { name: '安排下次回顾' })).toBeNull();
  });
});
