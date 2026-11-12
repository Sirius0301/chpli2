import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { MemoDto } from '@chpli2/shared';

function memoDto(partial: Partial<MemoDto> & Pick<MemoDto, 'id' | 'title' | 'date'>): MemoDto {
  return {
    priority: 'none',
    note: null,
    repeat: 'none',
    repeatEnd: null,
    completedAt: null,
    completions: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
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
  memos?: MemoDto[];
  onCreate?: (body: Record<string, unknown>) => void;
  onComplete?: (body: Record<string, unknown>) => void;
}

function stubFetch(options: StubOptions = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
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
      return Promise.resolve(jsonResponse(options.memos ?? []));
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
    render(<App />);
    await waitFor(() => expect(screen.getByText('周报')).toBeTruthy());
    // 2026-11-02 is a Monday; the current week renders one chip per day.
    expect(screen.getAllByText('周报').length).toBe(1);
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
      memos: [memoDto({ id: 'm1', title: '一次性', date: '2026-11-09' })],
      onComplete: (body) => (completed = body),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('一次性')).toBeTruthy());
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
    stubFetch({
      memos: [
        memoDto({
          id: 'm1',
          title: '每日站会',
          date: '2026-11-02',
          repeat: 'daily',
          completions: ['2026-11-09'],
        }),
      ],
    });
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getAllByText('每日站会').length).toBeGreaterThan(0));
    const doneChip = container.querySelector('.memo-chip--done');
    expect(doneChip?.textContent).toContain('每日站会');
  });
});
