import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { NoteDto } from '@chpli2/shared';

function noteDto(partial: Partial<NoteDto> & Pick<NoteDto, 'id' | 'title'>): NoteDto {
  return {
    body: '',
    priority: 'none',
    tags: [],
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
  tags?: { tag: string; count: number }[];
  onUpdate?: (body: Record<string, unknown>) => void;
  onDelete?: () => void;
  onList?: (url: string) => void;
  updateStatus?: number;
}

function stubFetch(options: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/notes/tags')) {
        return Promise.resolve(jsonResponse(options.tags ?? []));
      }
      if (url.startsWith('/api/notes') && init?.method === 'DELETE') {
        options.onDelete?.();
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.startsWith('/api/notes') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        if (options.updateStatus && options.updateStatus >= 400) {
          return Promise.resolve(
            jsonResponse({ errorCode: 'CONCURRENT_MODIFICATION', message: 'conflict' }, options.updateStatus),
          );
        }
        options.onUpdate?.(body);
        return Promise.resolve(jsonResponse({ ...body, id: url.split('/').pop()! }));
      }
      if (url.startsWith('/api/notes') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({}, 201));
      }
      if (url.startsWith('/api/notes')) {
        options.onList?.(url);
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
  vi.useRealTimers();
});

describe('Notes app (N1)', () => {
  it('lists notes and opens the editor (A70)', async () => {
    stubFetch({ notes: [noteDto({ id: 'n1', title: '第一笔记' })] });
    render(<App />);
    await waitFor(() => expect(screen.getByText('第一笔记')).toBeTruthy());
    fireEvent.click(screen.getByText('第一笔记'));
    await waitFor(() =>
      expect((screen.getByPlaceholderText('标题') as HTMLInputElement).value).toBe('第一笔记'),
    );
    expect(screen.getByTestId('save-state').textContent).toContain('已保存');
  });

  it('autosaves the draft after the debounce (A70/D4, fake timers)', async () => {
    let saved: Record<string, unknown> | undefined;
    stubFetch({
      notes: [noteDto({ id: 'n1', title: '自动保存', updatedAt: '2026-11-12T10:00:00.000Z' })],
      onUpdate: (body) => (saved = body),
    });
    // shouldAdvanceTime keeps RTL's waitFor working while the debounce is controllable.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<App />);
    await waitFor(() => expect(screen.getByText('自动保存')).toBeTruthy());
    fireEvent.click(screen.getByText('自动保存'));
    await waitFor(() => expect(screen.getByPlaceholderText('标题')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('以 Markdown 记录…'), {
      target: { value: '# 标题内容' },
    });
    expect(saved).toBeUndefined(); // not saved before the debounce fires
    await vi.advanceTimersByTimeAsync(1600);
    expect(saved).toBeTruthy();
    expect(saved!.body).toBe('# 标题内容');
    expect(saved!.updatedAt).toBe('2026-11-12T10:00:00.000Z'); // optimistic lock sent
  });

  it('renders Markdown in preview and escapes raw HTML (A71/E82)', async () => {
    stubFetch({
      notes: [
        noteDto({ id: 'n1', title: 'MD', body: '# 大标题\n\n**加粗** <img src=x onerror="globalThis.__xss=1">' }),
      ],
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('MD')).toBeTruthy());
    fireEvent.click(screen.getByText('MD'));
    fireEvent.click(screen.getByRole('button', { name: '预览' }));
    const preview = screen.getByTestId('preview');
    expect(preview.querySelector('h1')?.textContent).toBe('大标题');
    expect(preview.querySelector('strong')?.textContent).toBe('加粗');
    expect(preview.querySelector('img')).toBeNull(); // raw HTML never becomes DOM
    expect(
      (globalThis as unknown as { __xss?: boolean }).__xss,
    ).toBeUndefined();
  });

  it('sends the selected filters to the list API (A72)', async () => {
    const seen: string[] = [];
    stubFetch({
      tags: [{ tag: 'work', count: 2 }],
      notes: [noteDto({ id: 'n1', title: '筛选我', tags: ['work'] })],
      onList: (url) => seen.push(url),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('work')).toBeTruthy());
    fireEvent.click(screen.getByText('work'));
    await waitFor(() => expect(seen.some((u) => u.includes('tags=work'))).toBe(true));
    fireEvent.click(screen.getByText('高'));
    await waitFor(() =>
      expect(seen.some((u) => u.includes('tags=work') && u.includes('priorities=high'))).toBe(true),
    );
  });

  it('shows the conflict state on a 409 (E78)', async () => {
    stubFetch({
      notes: [noteDto({ id: 'n1', title: '冲突笔记', updatedAt: '2026-11-12T10:00:00.000Z' })],
      updateStatus: 409,
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('冲突笔记')).toBeTruthy());
    fireEvent.click(screen.getByText('冲突笔记'));
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: '改名' } });
    await waitFor(() => expect(screen.getByTestId('save-state').textContent).toContain('已在别处修改'), { timeout: 5000 });
  });

  it('deleting a note requires a second click (A18)', async () => {
    let deleted = false;
    stubFetch({
      notes: [noteDto({ id: 'n1', title: '待删除' })],
      onDelete: () => (deleted = true),
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('待删除')).toBeTruthy());
    fireEvent.click(screen.getByText('待删除'));
    const deleteButton = screen.getByRole('button', { name: '删除' });
    fireEvent.click(deleteButton);
    expect(deleted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '再次点击确认删除' }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
