import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { GoalDto } from '@chpli2/shared';

function goal(partial: Partial<GoalDto> & Pick<GoalDto, 'id' | 'title'>): GoalDto {
  return {
    description: null,
    status: 'active',
    targetDate: null,
    progress: 0,
    milestones: [],
    links: [],
    createdAt: '2026-11-13T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
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
  notes?: { id: string; title: string }[];
  bookmarks?: { id: string; title: string }[];
  onAddMilestone?: (body: Record<string, unknown>) => void;
  onToggleMilestone?: (status: string) => void;
  onAddLink?: (body: Record<string, unknown>) => void;
}

function stubFetch(options: StubOptions = {}) {
  const handlers: Record<string, (body: Record<string, unknown>) => GoalDto> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/goals') && init?.method === 'POST' && url.endsWith('/milestones')) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        options.onAddMilestone?.(body);
        return Promise.resolve(jsonResponse(handlers.addMilestone?.(body) ?? {}, 201));
      }
      if (url.includes('/milestones/') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        options.onToggleMilestone?.(body.status as string);
        return Promise.resolve(jsonResponse(handlers.toggle?.(body) ?? {}, 200));
      }
      if (url.endsWith('/links') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        options.onAddLink?.(body);
        return Promise.resolve(jsonResponse(handlers.addLink?.(body) ?? {}, 200));
      }
      if (url.startsWith('/api/goals')) {
        return Promise.resolve(jsonResponse(options.goals ?? []));
      }
      if (url.startsWith('/api/notes')) return Promise.resolve(jsonResponse(options.notes ?? []));
      if (url.startsWith('/api/bookmarks')) {
        return Promise.resolve(jsonResponse(options.bookmarks ?? []));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }),
  );
  return handlers;
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

describe('Growth app (G1)', () => {
  it('renders the derived progress bar and toggling a milestone updates it (A97)', async () => {
    const g = goal({
      id: 'g1',
      title: '成为架构师',
      milestones: [
        { id: 'm1', goalId: 'g1', title: '完成重构', date: null, status: 'done', completedAt: '2026-11-13T00:00:00.000Z', createdAt: '2026-11-13T00:00:00.000Z', updatedAt: '2026-11-13T00:00:00.000Z' },
        { id: 'm2', goalId: 'g1', title: '写设计文档', date: null, status: 'open', completedAt: null, createdAt: '2026-11-13T00:00:00.000Z', updatedAt: '2026-11-13T00:00:00.000Z' },
      ],
      progress: 50,
    });
    let toggled: string | undefined;
    const handlers = stubFetch({
      goals: [g],
      onToggleMilestone: (status) => (toggled = status),
    });
    handlers.toggle = () => goal({ ...g, progress: 100, milestones: g.milestones!.map((m) => ({ ...m, status: 'done' as const })) });

    const { container } = render(<App />);
    const main = () => within(container.querySelector('.goal-main') as HTMLElement);
    await waitFor(() => expect(main().getByText('成为架构师')).toBeTruthy());
    const bar = screen.getByTestId('progress-bar') as HTMLSpanElement;
    expect(bar.style.width).toBe('50%');

    fireEvent.click(screen.getByRole('checkbox', { name: '写设计文档' }));
    await waitFor(() => expect(toggled).toBe('done'));
    await waitFor(() => expect((screen.getByTestId('progress-bar') as HTMLSpanElement).style.width).toBe('100%'));
  });

  it('adds a milestone through the input row', async () => {
    let added: Record<string, unknown> | undefined;
    const handlers = stubFetch({ goals: [goal({ id: 'g1', title: '目标' })], onAddMilestone: (b) => (added = b) });
    handlers.addMilestone = () => goal({ id: 'g1', title: '目标' });
    const { container } = render(<App />);
    const main = () => within(container.querySelector('.goal-main') as HTMLElement);
    await waitFor(() => expect(main().getByText('目标')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('里程碑名称'), { target: { value: '  第一阶段 ' } });
    fireEvent.click(screen.getByRole('button', { name: '添加里程碑' }));
    await waitFor(() => expect(added).toBeTruthy());
    expect(added!.title).toBe('第一阶段');
  });

  it('adds a note link from the picker (A99)', async () => {
    let linked: Record<string, unknown> | undefined;
    const g = goal({ id: 'g1', title: '目标' });
    const handlers = stubFetch({
      goals: [g],
      notes: [{ id: 'n1', title: '职业规划笔记' }],
      onAddLink: (b) => (linked = b),
    });
    handlers.addLink = (b) =>
      goal({ ...g, links: [{ id: 'l1', module: b.module as never, refId: b.refId as string, title: '职业规划笔记', createdAt: '2026-11-13T00:00:00.000Z' }] });
    const { container } = render(<App />);
    const main = () => within(container.querySelector('.goal-main') as HTMLElement);
    await waitFor(() => expect(main().getByText('目标')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('关联笔记…'), { target: { value: 'n1' } });
    await waitFor(() => expect(linked).toMatchObject({ module: 'notes', refId: 'n1' }));
    await waitFor(() => expect(main().getByText('职业规划笔记')).toBeTruthy());
  });

  it('opening a link writes the mailbox and asks the host to navigate (A100/D6)', async () => {
    const navigate = vi.fn();
    window.addEventListener('chpli2-navigate', navigate);
    const g = goal({
      id: 'g1',
      title: '目标',
      links: [{ id: 'l1', module: 'notes', refId: 'n1', title: '某笔记', createdAt: '2026-11-13T00:00:00.000Z' }],
    });
    stubFetch({ goals: [g] });
    render(<App />);
    await waitFor(() => expect(screen.getByText('某笔记')).toBeTruthy());

    fireEvent.click(within(document.querySelector('.goal-detail') as HTMLElement).getByRole('button', { name: '打开' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const mailbox = JSON.parse(window.sessionStorage.getItem('chpli2-pending-open')!) as { module: string; id: string };
    expect(mailbox).toEqual({ module: 'notes', id: 'n1' });
    window.removeEventListener('chpli2-navigate', navigate);
  });
});
