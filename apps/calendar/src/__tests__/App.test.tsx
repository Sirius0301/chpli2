import { fireEvent, render, screen } from '@testing-library/react';
import i18n, { LANGUAGE_CHANGED_EVENT } from '../i18n';
import App, { OPEN_TRIP_EVENT } from '../App';
import type { CalendarDto } from '@chpli2/shared';

const calendars: CalendarDto[] = [
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
];

/** A travel-synced event a few days in the future so it lands in the grid. */
function futureTravelEvent(daysAhead: number) {
  const start = new Date();
  start.setDate(start.getDate() + daysAhead);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return {
    id: 'tr-event-1',
    title: 'Flight to Osaka',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone: 'UTC',
    source: { module: 'travel', type: 'transport', id: 'tr1', tripId: 't1' },
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  // Node >= 22 exposes its own (empty) localStorage global that shadows
  // jsdom's in this environment; guard the reset.
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

function stubFetch(overrides: Record<string, unknown> = {}) {
  const posts: unknown[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/calendar/calendars')) {
      return Promise.resolve(jsonResponse(overrides.calendars ?? calendars));
    }
    if (url.startsWith('/api/calendar/events') && init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)));
      return Promise.resolve(jsonResponse({ id: 'new-event' }, 201));
    }
    if (url.startsWith('/api/calendar/events')) {
      return Promise.resolve(jsonResponse(overrides.events ?? []));
    }
    if (url.startsWith('/api/calendar/travel-events')) {
      return Promise.resolve(jsonResponse(overrides.travelEvents ?? [futureTravelEvent(3)]));
    }
    if (url.startsWith('/api/calendar/holidays')) {
      return Promise.resolve(jsonResponse(overrides.holidays ?? []));
    }
    if (url.startsWith('/api/calendar/reminders/due')) {
      return Promise.resolve(jsonResponse(overrides.due ?? []));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, posts };
}

describe('CalendarApp', () => {
  it('shows the sidebar calendar list and a travel-synced event in the month grid', async () => {
    stubFetch();
    const openTripHandler = vi.fn();
    window.addEventListener(OPEN_TRIP_EVENT, openTripHandler);

    render(<App />);

    // Sidebar lists the default calendar.
    expect(await screen.findByText('Personal')).toBeTruthy();

    // The travel-synced event renders as a chip in the month view.
    const chip = await screen.findByText(/Flight to Osaka/);
    expect(chip).toBeTruthy();

    // Clicking it notifies the host to open the related trip.
    fireEvent.click(chip);
    expect(openTripHandler).toHaveBeenCalledTimes(1);
    const dispatched = openTripHandler.mock.calls[0]![0] as CustomEvent<{ tripId: string }>;
    expect(dispatched.detail).toEqual({ tripId: 't1' });

    window.removeEventListener(OPEN_TRIP_EVENT, openTripHandler);
  });

  it('creates an event into the default calendar (A2)', async () => {
    const { posts } = stubFetch();
    render(<App />);
    await screen.findByText('Personal');

    // Click an empty day cell to open the create modal.
    const cells = document.querySelectorAll('.month-cell');
    fireEvent.click(cells[10]!);

    // Fill the title and save.
    const titleInput = await screen.findByLabelText('标题');
    fireEvent.change(titleInput, { target: { value: 'Dentist appointment' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0] as { title: string; calendarId: string; id: string };
    expect(body.title).toBe('Dentist appointment');
    expect(body.calendarId).toBe('cal-1'); // saved to the default calendar
    expect(typeof body.id).toBe('string'); // client-generated idempotency id
  });

  it('shows an error banner when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 500))),
    );
    render(<App />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('出错了，请稍后重试')).toBeTruthy();
  });

  it('re-renders the toolbar title in the selected language', async () => {
    stubFetch();
    render(<App />);
    await screen.findByText('Personal');

    const now = new Date();
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'en' } }));
    const enTitle = now.toLocaleString('en', { year: 'numeric', month: 'long' });
    // The toolbar and the mini calendar both carry the month heading.
    expect((await screen.findAllByRole('heading', { name: enTitle })).length).toBeGreaterThan(0);

    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'de' } }));
    const deTitle = now.toLocaleString('de', { year: 'numeric', month: 'long' });
    expect((await screen.findAllByRole('heading', { name: deTitle })).length).toBeGreaterThan(0);
  });
});
