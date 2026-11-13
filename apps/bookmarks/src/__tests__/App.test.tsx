import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { BookmarkDto } from '@chpli2/shared';

function bm(partial: Partial<BookmarkDto> & Pick<BookmarkDto, 'id' | 'title'>): BookmarkDto {
  return {
    url: 'https://example.com/',
    domain: 'example.com',
    description: null,
    categories: [],
    hasCover: false,
    clickCount: 0,
    lastClickedAt: null,
    inactive: false,
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
  bookmarks?: BookmarkDto[];
  onList?: (url: string) => void;
  onClick?: (id: string) => void;
  onCreate?: (body: Record<string, unknown>) => void;
}

function stubFetch(options: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/click') && init?.method === 'POST') {
        options.onClick?.(url.split('/')[3]!);
        return Promise.resolve(jsonResponse({}, 201));
      }
      if (url.startsWith('/api/bookmarks') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        options.onCreate?.(body);
        return Promise.resolve(
          jsonResponse(
            bm({
              id: (body.id as string) ?? 'created',
              title: (body.title as string) ?? 'x',
              url: (body.url as string) ?? 'https://example.com/',
            }),
            201,
          ),
        );
      }
      if (url.startsWith('/api/bookmarks')) {
        options.onList?.(url);
        return Promise.resolve(jsonResponse(options.bookmarks ?? []));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }),
  );
}

beforeEach(async () => {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    /* storage unavailable */
  }
  await i18n.changeLanguage('zh-CN');
  vi.stubGlobal('open', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Bookmarks app (B1)', () => {
  it('splits active and inactive bookmarks and renders the gray compact list (A96)', async () => {
    stubFetch({
      bookmarks: [
        bm({ id: 'a', title: '活跃书签', categories: ['dev'] }),
        bm({ id: 'b', title: '沉睡书签', categories: ['old'], inactive: true }),
      ],
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('活跃书签')).toBeTruthy());

    const section = screen.getByTestId('inactive-section');
    expect(section.textContent).toContain('不活跃');
    expect(section.textContent).toContain('1');

    // Collapsed by default; expanding reveals the compact row (name/categories/domain only).
    expect(screen.queryByTestId('inactive-list')).toBeNull();
    fireEvent.click(screen.getByText('展开'));
    const list = await screen.findByTestId('inactive-list');
    expect(list.textContent).toContain('沉睡书签');
    expect(list.textContent).toContain('old');
    expect(list.textContent).toContain('example.com');
    expect(list.querySelector('.bm-item__meta')).toBeNull(); // no click stats in compact rows
  });

  it('sends the chosen sort and persists view/sort preferences (A95)', async () => {
    // Node's own localStorage global shadows jsdom's in this environment;
    // install a simple in-memory implementation for this test.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    });
    const seen: string[] = [];
    stubFetch({ bookmarks: [bm({ id: 'a', title: 'X' })], onList: (url) => seen.push(url) });
    const { unmount } = render(<App />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('排序'), { target: { value: 'clicks' } });
    await waitFor(() => expect(seen.some((u) => u.includes('sort=clicks'))).toBe(true));

    fireEvent.click(screen.getByRole('tab', { name: '列表' }));
    expect(JSON.parse(store.get('chpli2-bookmarks-prefs')!)).toMatchObject({
      view: 'list',
      sort: 'clicks',
    });
    unmount();

    // Preferences restore on reload.
    render(<App />);
    await waitFor(() =>
      expect(
        (screen.getByRole('tab', { name: '列表' }) as HTMLButtonElement).getAttribute('aria-selected'),
      ).toBe('true'),
    );
  });

  it('clicking a bookmark opens it and records the click (A94)', async () => {
    let clickedId: string | undefined;
    stubFetch({ bookmarks: [bm({ id: 'a', title: '可点击' })], onClick: (id) => (clickedId = id) });
    render(<App />);
    await waitFor(() => expect(screen.getByText('可点击')).toBeTruthy());
    fireEvent.click(screen.getByText('可点击'));
    await waitFor(() => expect(clickedId).toBe('a'));
    expect(window.open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
  });

  it('creates a bookmark with trimmed fields (A82)', async () => {
    let created: Record<string, unknown> | undefined;
    stubFetch({ onCreate: (body) => (created = body) });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: '新建书签' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '新建书签' }));
    await waitFor(() => expect(screen.getByPlaceholderText('名称', { exact: true })).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('名称', { exact: true }), {
      target: { value: '  我的书签 ' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://…', { exact: true }), {
      target: { value: 'https://foo.bar/x' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(created).toBeTruthy());
    expect(created!.title).toBe('我的书签');
    expect(created!.url).toBe('https://foo.bar/x');
  });

  it('rejects an invalid URL inline (E89)', async () => {
    stubFetch({});
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: '新建书签' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '新建书签' }));
    await waitFor(() => expect(screen.getByPlaceholderText('名称', { exact: true })).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('名称', { exact: true }), { target: { value: 'x' } });
    fireEvent.change(screen.getByPlaceholderText('https://…', { exact: true }), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('http'));
  });
});
