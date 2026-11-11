import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import { displayEvent } from '../view-model';
import type { EventDto } from '@chpli2/shared';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

function stubFetch() {
  const posts: unknown[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/calendar/calendars')) {
      return Promise.resolve(
        jsonResponse([
          {
            id: 'cal-1',
            name: 'Personal',
            color: '#0A84FF',
            type: 'custom',
            readonly: false,
            regionCode: null,
            isDefault: true,
            sortOrder: 0,
            hidden: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      );
    }
    if (url.startsWith('/api/calendar/events') && init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)));
      return Promise.resolve(jsonResponse({ id: 'new-event' }, 201));
    }
    if (url.startsWith('/api/calendar/events')) return Promise.resolve(jsonResponse([]));
    if (url.startsWith('/api/calendar/travel-events')) return Promise.resolve(jsonResponse([]));
    if (url.startsWith('/api/calendar/holidays')) return Promise.resolve(jsonResponse([]));
    if (url.startsWith('/api/calendar/reminders/due')) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { posts };
}

/** Opens the create modal by clicking a month cell. */
async function openCreateModal() {
  render(<App />);
  await screen.findByText('Personal');
  const cells = document.querySelectorAll('.month-cell');
  fireEvent.click(cells[10]!);
}

describe('floating time display conversion (E18)', () => {
  const base: EventDto = {
    id: 'e1',
    calendarId: 'cal-1',
    title: 'Standup',
    startAt: '2026-06-01T09:00:00.000Z',
    endAt: '2026-06-01T09:30:00.000Z',
    allDay: false,
    timezone: null,
    location: null,
    description: null,
    sourceModule: null,
    sourceRef: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  it('renders a floating event at its stored wall clock in any viewer timezone', () => {
    const shown = displayEvent(base, '#0A84FF');
    expect(shown.startAt.getFullYear()).toBe(2026);
    expect(shown.startAt.getMonth()).toBe(5);
    expect(shown.startAt.getDate()).toBe(1);
    expect(shown.startAt.getHours()).toBe(9);
    expect(shown.startAt.getMinutes()).toBe(0);
    expect(shown.endAt.getHours()).toBe(9);
    expect(shown.endAt.getMinutes()).toBe(30);
  });

  it('keeps fixed-zone events at their absolute instant', () => {
    const fixed = { ...base, timezone: 'Europe/Berlin' };
    const shown = displayEvent(fixed, '#0A84FF');
    expect(shown.startAt.getTime()).toBe(new Date('2026-06-01T09:00:00.000Z').getTime());
  });
});

describe('event creation with timezone semantics (A20/A21)', () => {
  it('submits wall-clock strings with the selected fixed zone', async () => {
    const { posts } = stubFetch();
    await openCreateModal();

    fireEvent.change(await screen.findByLabelText('时区'), {
      target: { value: 'Europe/Berlin' },
    });
    fireEvent.change(screen.getByLabelText('开始'), {
      target: { value: '2026-06-01T09:00' },
    });
    fireEvent.change(screen.getByLabelText('结束'), {
      target: { value: '2026-06-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0] as { startAt: string; endAt: string; timezone: string };
    expect(body.startAt).toBe('2026-06-01T09:00');
    expect(body.endAt).toBe('2026-06-01T10:00');
    expect(body.timezone).toBe('Europe/Berlin');
  });

  it('submits floating time with timezone null (A22)', async () => {
    const { posts } = stubFetch();
    await openCreateModal();

    fireEvent.change(await screen.findByLabelText('时区'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('开始'), {
      target: { value: '2026-06-01T09:00' },
    });
    fireEvent.change(screen.getByLabelText('结束'), {
      target: { value: '2026-06-01T09:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0] as { startAt: string; timezone: string | null };
    expect(body.startAt).toBe('2026-06-01T09:00');
    expect(body.timezone).toBeNull();
  });

  it('blocks a wall clock that does not exist in the selected zone (E15)', async () => {
    const { posts } = stubFetch();
    await openCreateModal();

    fireEvent.change(await screen.findByLabelText('时区'), {
      target: { value: 'Europe/Berlin' },
    });
    fireEvent.change(screen.getByLabelText('开始'), {
      target: { value: '2026-03-29T02:30' },
    });
    fireEvent.change(screen.getByLabelText('结束'), {
      target: { value: '2026-03-29T03:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(
      await screen.findByText('所选时刻在该时区不存在（夏令时切换），请调整时间'),
    ).toBeTruthy();
    expect(posts).toHaveLength(0);
  });
});
