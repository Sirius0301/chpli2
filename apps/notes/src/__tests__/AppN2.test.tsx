import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

/** 侧栏列表已移除：打开笔记统一走 NotesHome 卡片（可访问名含标题/摘要/元信息）。 */
const noteCard = (title: string) =>
  within(screen.getByTestId('notes-home')).getByRole('button', { name: new RegExp(title) });
import i18n from '../i18n';
import App from '../App';
import type { NoteDto } from '@chpli2/shared';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function noteDto(partial: Partial<NoteDto> & Pick<NoteDto, 'id' | 'title'>): NoteDto {
  return {
    body: '',
    priority: 'none',
    tags: [],
    category: null,
    excerpt: null,
    allowComments: true,
    pinned: false,
    hasAccessPassword: false,
    showOnHome: false,
    publishStatus: 'draft',
    publishAt: null,
    publishedAt: null,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
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
  notes?: NoteDto[];
  onList?: (url: string) => void;
  onRestore?: (seq: number) => void;
  versions?: unknown[];
  backlinks?: unknown[];
}

function stubFetch(options: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/versions/') && init?.method === 'POST') {
        options.onRestore?.(Number(url.split('/versions/')[1]!.split('/')[0]));
        // A real restore returns the full restored NoteDto (handleRestore feeds
        // it straight into the draft) — respond with the seeded note shape.
        return Promise.resolve(jsonResponse(options.notes?.[0] ?? {}, 201));
      }
      if (url.endsWith('/versions')) return Promise.resolve(jsonResponse(options.versions ?? []));
      if (url.endsWith('/backlinks')) return Promise.resolve(jsonResponse(options.backlinks ?? []));
      if (url.startsWith('/api/notes')) {
        options.onList?.(url);
        // GET /api/notes/<uuid> fetches a single note; the bare path lists.
        const single = url.match(/^\/api\/notes\/([0-9a-f-]{36})$/);
        if (single && !init?.method) {
          return Promise.resolve(
            jsonResponse((options.notes ?? []).find((n) => n.id === single[1]) ?? {}),
          );
        }
        return Promise.resolve(jsonResponse(options.notes ?? []));
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Notes app N2', () => {
  it('debounces the search box and sends q to the list API (A76)', async () => {
    const seen: string[] = [];
    stubFetch({
      notes: [noteDto({ id: A, title: '目标笔记' })],
      onList: (url) => seen.push(url),
    });
    render(<App />);
    await waitFor(() => expect(noteCard('目标笔记')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('搜索标题、正文、标签…'), {
      target: { value: '关键词' },
    });
    await waitFor(() =>
      expect(seen.some((u) => u.includes(`q=${encodeURIComponent('关键词')}`))).toBe(true),
    );
  });

  it('renders [[id]] as a clickable title link and broken tokens as non-clickable (A77/E84)', async () => {
    stubFetch({
      notes: [
        noteDto({ id: A, title: '主页' }),
        noteDto({ id: B, title: '引用者', body: `see [[${A}]] and [[99999999-8888-4777-8666-555555555555]]` }),
      ],
    });
    render(<App />);
    await waitFor(() => expect(noteCard('引用者')).toBeTruthy());
    fireEvent.click(noteCard('引用者'));
    fireEvent.click(screen.getByRole('tab', { name: '预览' }));

    const link = within(await screen.findByTestId('preview')).getByRole('button', { name: '主页' });
    expect(link.className).toContain('wiki-link');
    expect(link.className).not.toContain('wiki-link--broken');

    const broken = screen.getByTitle('失效链接');
    expect(broken.className).toContain('wiki-link--broken');

    // Clicking the resolved link opens that note.
    fireEvent.click(link);
    await waitFor(() =>
      expect((screen.getByPlaceholderText('输入标题') as HTMLInputElement).value).toBe('主页'),
    );
  });

  it('lists backlinks of the selected note (A78)', async () => {
    stubFetch({
      notes: [noteDto({ id: A, title: '主页' })],
      backlinks: [{ id: B, title: '引用者' }],
    });
    render(<App />);
    await waitFor(() => expect(noteCard('主页')).toBeTruthy());
    fireEvent.click(noteCard('主页'));
    fireEvent.click(screen.getByRole('button', { name: /反链/ }));
    const panel = await screen.findByTestId('backlinks-panel');
    expect(panel.textContent).toContain('引用者');
  });

  it('restores a version through the history panel with a second click (A79)', async () => {
    let restoredSeq: number | undefined;
    stubFetch({
      notes: [noteDto({ id: A, title: '主页', updatedAt: '2026-11-12T10:00:00.000Z' })],
      versions: [{ seq: 2, title: 'v2', body: 'b2', priority: 'none', tags: [], createdAt: '2026-11-12T11:00:00.000Z' }],
      onRestore: (seq) => (restoredSeq = seq),
    });
    render(<App />);
    await waitFor(() => expect(noteCard('主页')).toBeTruthy());
    fireEvent.click(noteCard('主页'));
    fireEvent.click(screen.getByRole('button', { name: '历史版本' }));
    const panel = await screen.findByTestId('versions-panel');
    expect(panel.textContent).toContain('v2');

    fireEvent.click(screen.getByRole('button', { name: '恢复' }));
    expect(restoredSeq).toBeUndefined(); // confirmation step first
    fireEvent.click(screen.getByRole('button', { name: '确认恢复？' }));
    await waitFor(() => expect(restoredSeq).toBe(2));
  });
});
