import { fireEvent, render, screen } from '@testing-library/react';
import i18n, { LANGUAGE_CHANGED_EVENT } from '../i18n';
import App, { OPEN_TRIP_EVENT } from '../App';
import type { CalendarEventDto } from '@chpli2/shared';

const events: CalendarEventDto[] = [
  {
    id: 'e2',
    title: 'Train back to Tokyo',
    startsAt: '2026-11-03T09:00:00+09:00',
    endsAt: '2026-11-03T12:00:00+09:00',
    timezone: 'Asia/Tokyo',
    source: { module: 'travel', type: 'transport', id: 'tr2', tripId: 't1' },
  },
  {
    id: 'e1',
    title: 'Flight to Osaka',
    startsAt: '2026-12-05T10:00:00+09:00',
    endsAt: '2026-12-05T12:30:00+09:00',
    timezone: 'Asia/Tokyo',
    source: { module: 'travel', type: 'transport', id: 'tr1', tripId: 't1' },
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubEventsFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    if (String(input) === '/api/calendar/events') {
      return Promise.resolve(jsonResponse(events));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('CalendarApp', () => {
  it('groups events by month, shows the Travel badge and opens the trip on click', async () => {
    stubEventsFetch();
    const openTripHandler = vi.fn();
    window.addEventListener(OPEN_TRIP_EVENT, openTripHandler);

    render(<App />);

    // Both events visible with their Travel source badge (two badges rendered).
    expect(await screen.findByText('Flight to Osaka')).toBeTruthy();
    expect(screen.getByText('Train back to Tokyo')).toBeTruthy();
    expect(screen.getAllByText('Travel').length).toBe(2);

    // Clicking an event notifies the host to open the related trip.
    fireEvent.click(screen.getByText('Flight to Osaka'));
    expect(openTripHandler).toHaveBeenCalledTimes(1);
    const dispatched = openTripHandler.mock.calls[0]![0] as CustomEvent<{
      tripId: string;
    }>;
    expect(dispatched.detail).toEqual({ tripId: 't1' });

    window.removeEventListener(OPEN_TRIP_EVENT, openTripHandler);
  });

  it('re-renders month headings in the selected language', async () => {
    stubEventsFetch();
    render(<App />);
    await screen.findByText('Flight to Osaka');

    // zh default: no crash on render; switch to English.
    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'en' } }),
    );
    expect(await screen.findByText('December 2026')).toBeTruthy();
    expect(screen.getByText('November 2026')).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'de' } }),
    );
    expect(await screen.findByText('Dezember 2026')).toBeTruthy();
  });

  it('shows an error hint when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 500))),
    );
    render(<App />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('出错了，请稍后重试')).toBeTruthy();
  });
});
