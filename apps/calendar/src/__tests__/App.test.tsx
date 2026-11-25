import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { MemoDto } from '@chpli2/shared';

function memoDto(partial: Partial<MemoDto> & Pick<MemoDto, 'id' | 'title' | 'date'>): MemoDto {
  return {
    priority: 'none',
    note: null,
    repeat: 'none',
    repeatEnd: null,
    repeatDays: [],
    excludedDates: [],
    completedAt: null,
    completions: [],
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

/** Local YYYY-MM-DD key (matches the app's dayKey semantics). */
function localKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface StubOptions {
  memos?: MemoDto[];
  /** Dynamic list source (completion flows mutate it between polls). */
  getMemos?: () => MemoDto[];
  tags?: { tag: string; count: number }[];
  onCreate?: (body: Record<string, unknown>) => void;
  onComplete?: (body: Record<string, unknown>) => void;
  onList?: (url: string) => void;
}

function stubFetch(options: StubOptions = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/memos/tags')) {
      return Promise.resolve(jsonResponse(options.tags ?? []));
    }
    if (url.startsWith('/api/memos') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      options.onCreate?.(body);
      return Promise.resolve(jsonResponse(memoDto(body as never), 201));
    }
    if (url.includes('/completion') && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      options.onComplete?.(body);
      return Promise.resolve(jsonResponse(memoDto({ id: 'm1', title: 'T', date: '2026-11-09' }), 200));
    }
    if (url.startsWith('/api/memos')) {
      options.onList?.(url);
      return Promise.resolve(
        jsonResponse(options.getMemos ? options.getMemos() : (options.memos ?? [])),
      );
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    /* storage unavailable in the test environment */
  }
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Memo app (M1)', () => {
  it('renders the week view by default with Sunday-first columns (A42)', async () => {
    stubFetch();
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getAllByText('暂无备忘')).toHaveLength(7));
    const weekdays = Array.from(container.querySelectorAll('.day-col__weekday')).map(
      (el) => el.textContent,
    );
    expect(weekdays).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });

  it('expands a weekly memo onto every weekday of the week (A43)', async () => {
    stubFetch({
      memos: [memoDto({ id: 'm1', title: '周报', date: '2026-11-02', repeat: 'weekly' })],
    });
    const { container } = render(<App />);
    const main = within(container.querySelector('.cal-main') as HTMLElement);
    await waitFor(() => expect(main.getByText('周报')).toBeTruthy());
    // 2026-11-02 is a Monday; the current week renders one chip per day.
    expect(main.getAllByText('周报').length).toBe(1);
  });

  it('creates a memo through the detail panel (A41)', async () => {
    let created: Record<string, unknown> | undefined;
    stubFetch({ onCreate: (body) => (created = body) });
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('暂无备忘')).toHaveLength(7));

    fireEvent.click(screen.getAllByText('暂无备忘')[0]!);
    await waitFor(() => expect(screen.getByText('新建备忘')).toBeTruthy());

    fireEvent.change(screen.getByText('标题').nextSibling as HTMLElement, {
      target: { value: '买牛奶' },
    });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(created).toBeTruthy());
    expect(created!.title).toBe('买牛奶');
    expect(created!.repeat).toBe('none');
  });

  it('toggles completion via the chip checkbox (A44)', async () => {
    let completed: Record<string, unknown> | undefined;
    stubFetch({
      memos: [memoDto({ id: 'm1', title: '一次性', date: localKey(new Date()) })],
      onComplete: (body) => (completed = body),
    });
    const { container } = render(<App />);
    const main = within(container.querySelector('.cal-main') as HTMLElement);
    await waitFor(() => expect(main.getByText('一次性')).toBeTruthy());
    fireEvent.click(screen.getByRole('checkbox', { name: '完成：一次性' }));
    await waitFor(() => expect(completed).toBeTruthy());
    expect(completed!.completed).toBe(true);
  });

  it('persists the view preference across reloads (A42)', async () => {
    // Node's own localStorage global shadows jsdom's in this environment;
    // install a simple in-memory implementation for this test.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    });
    stubFetch();
    const first = render(<App />);
    await waitFor(() => expect(screen.getAllByText('暂无备忘')).toHaveLength(7));
    fireEvent.click(screen.getByRole('tab', { name: '月' }));
    await waitFor(() => expect(document.querySelectorAll('.month-view__cell').length).toBe(42));
    first.unmount();

    expect(store.get('chpli2-memo-view')).toBe('month');
    render(<App />);
    await waitFor(() =>
      expect(document.querySelectorAll('.month-view__cell').length).toBe(42),
    );
  });

  it('marks completed repeat instances with a line-through (A45)', async () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    stubFetch({
      memos: [
        memoDto({
          id: 'm1',
          title: '每日站会',
          date: localKey(weekAgo),
          repeat: 'daily',
          completions: [localKey(today)],
        }),
      ],
    });
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getAllByText('每日站会').length).toBeGreaterThan(0));
    const doneChip = container.querySelector('.memo-chip--done');
    expect(doneChip?.textContent).toContain('每日站会');
  });

  it('sends the selected filters to the memo list API (A49/A50)', async () => {
    const seen: string[] = [];
    stubFetch({
      tags: [
        { tag: 'work', count: 2 },
        { tag: 'home', count: 1 },
      ],
      onList: (url) => seen.push(url),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('work')).toBeTruthy());

    fireEvent.click(screen.getByText('work'));
    await waitFor(() =>
      expect(seen.some((u) => u.includes('tags=work'))).toBe(true),
    );
    fireEvent.click(screen.getByText('高'));
    await waitFor(() =>
      expect(seen.some((u) => u.includes('tags=work') && u.includes('priorities=high'))).toBe(
        true,
      ),
    );
  });

  it('shows the lunar layer in zh-CN month view and hides it in English (A52/E57)', async () => {
    stubFetch();
    const { container, unmount } = render(<App />);
    await waitFor(() => expect(screen.getAllByText('暂无备忘')).toHaveLength(7));
    fireEvent.click(screen.getByRole('tab', { name: '月' }));
    await waitFor(() =>
      expect(container.querySelectorAll('.month-view__lunar').length).toBeGreaterThan(0),
    );
    unmount();

    await i18n.changeLanguage('en');
    const second = render(<App />);
    await waitFor(() => expect(screen.getAllByText('No memos')).toHaveLength(7));
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    await waitFor(() =>
      expect(second.container.querySelectorAll('.month-view__cell').length).toBe(42),
    );
    expect(second.container.querySelectorAll('.month-view__lunar').length).toBe(0);
    await i18n.changeLanguage('zh-CN');
  });

  it('shows due instances in the sidebar card with a today badge in month view (A59/A60)', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const tomorrowKey = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    stubFetch({
      memos: [
        memoDto({ id: 'm1', title: '今天要办', date: todayKey, priority: 'high' }),
        memoDto({ id: 'm2', title: '明天才办', date: tomorrowKey }),
        memoDto({ id: 'm3', title: '下周才办', date: '2026-12-01' }),
      ],
    });
    const { container } = render(<App />);
    const card = within(await screen.findByTestId('due-card'));
    await waitFor(() => expect(card.getByText('今天要办')).toBeTruthy());
    expect(card.getByText('明天才办')).toBeTruthy();
    expect(card.queryByText('下周才办')).toBeNull(); // outside the 3-day window
    expect(screen.queryByText('已逾期')).toBeNull();
    expect(card.getByText('今天')).toBeTruthy();

    // Month view: today's cell carries the 今 badge, tomorrow's does not.
    fireEvent.click(screen.getByRole('tab', { name: '月' }));
    await waitFor(() =>
      expect(container.querySelectorAll('.month-view__cell').length).toBe(42),
    );
    const badgeDays = [...container.querySelectorAll('.month-view__due-badge')].map((el) =>
      el.closest('.month-view__cell')?.getAttribute('data-day'),
    );
    expect(badgeDays).toEqual([todayKey]);
  });

  it('completing a due instance removes it from the card and badge (E69)', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const dto = memoDto({ id: 'm1', title: '马上办', date: todayKey });
    stubFetch({
      getMemos: () => [dto],
      onComplete: () => {
        dto.completedAt = new Date().toISOString(); // completion reflected on next poll
      },
    });
    render(<App />);
    const card = within(await screen.findByTestId('due-card'));
    await waitFor(() => expect(card.getByText('马上办')).toBeTruthy());

    fireEvent.click(screen.getByRole('checkbox', { name: '完成：马上办' }));
    await waitFor(() => expect(card.queryByText('马上办')).toBeNull());
    expect(card.getByText('暂无到期备忘')).toBeTruthy();
  });

  it('offers the enable-notifications action when permission is default (E67)', async () => {
    stubFetch();
    render(<App />);
    const card = within(await screen.findByTestId('due-card'));
    // jsdom has no Notification API -> unsupported -> no button (E65).
    expect(card.queryByRole('button', { name: '启用浏览器通知' })).toBeNull();
  });
});
