import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import TripDetail from '../components/TripDetail';
import type { TripDto } from '@chpli2/shared';

function makeTrip(): TripDto {
  return {
    id: 't1',
    title: '日本行',
    type: 'PLAN',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    transports: [
      {
        id: 'tr1',
        tripId: 't1',
        mode: 'TRAIN',
        origin: { level: 'CITY', id: 'city1', name: '东京' },
        destination: { level: 'CITY', id: 'city2', name: '大阪' },
        plannedDepartureAt: '2026-12-01T01:00:00.000Z',
        plannedArrivalAt: null,
        actualDepartureAt: null,
        actualArrivalAt: null,
        calendarSync: {
          eventId: 'e1',
          syncKey: 'travel:transport:tr1',
          syncedAt: '2026-01-01T00:00:00.000Z',
          status: 'SYNCED',
        },
      },
    ],
  };
}

let tripData: TripDto;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/travel/trips/t1') {
      return Promise.resolve(jsonResponse(tripData));
    }
    if (url === '/api/travel/transports/tr1' && init?.method === 'DELETE') {
      tripData = { ...tripData, transports: [] };
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  localStorage.clear();
  tripData = makeTrip();
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TripDetail delete confirmation flow', () => {
  it('cancelling the dialog does not delete; confirming deletes and refreshes', async () => {
    const fetchMock = stubFetch();
    render(<TripDetail tripId="t1" onBack={() => {}} />);

    // List renders the transport and its calendar sync badge.
    expect(await screen.findByText(/东京.*大阪/)).toBeTruthy();
    expect(screen.getByText('已同步日历')).toBeTruthy();

    // Open the confirm dialog, then cancel: no DELETE may be sent.
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('确定要删除这段交通吗？此操作不可撤销。')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === '/api/travel/transports/tr1' &&
          (init as RequestInit | undefined)?.method === 'DELETE',
      ),
    ).toBe(false);

    // Re-open and confirm: DELETE is sent and the list refreshes to empty.
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url) === '/api/travel/transports/tr1' &&
            (init as RequestInit | undefined)?.method === 'DELETE',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('暂无交通段，添加第一段交通吧。')).toBeTruthy();
    expect(screen.queryByText(/东京.*大阪/)).toBeNull();
  });
});

describe('TripDetail language switching', () => {
  it('re-renders the UI text after a language change event', async () => {
    stubFetch();
    render(<TripDetail tripId="t1" onBack={() => {}} />);

    expect(await screen.findByRole('button', { name: /返回行程列表/ })).toBeTruthy();

    await i18n.changeLanguage('en');
    expect(await screen.findByRole('button', { name: /Back to trips/ })).toBeTruthy();
    expect(screen.getByText('Synced to calendar')).toBeTruthy();
  });
});
