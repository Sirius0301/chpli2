import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n, { LANGUAGE_CHANGED_EVENT } from '../i18n';
import TransportForm from '../components/TransportForm';
import type { TripDto } from '@chpli2/shared';

const countries = [
  { id: 'c1', name: 'China', code: 'CN' },
  { id: 'c2', name: 'Japan', code: 'JP' },
];

const planTrip: TripDto = {
  id: 't1',
  title: 'Two weeks in Japan',
  type: 'PLAN',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  transports: [],
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TransportForm instant validation', () => {
  it('shows ROUTE_SAME_ENDPOINT hint when origin equals destination', async () => {
    stubFetch((url) =>
      url === '/api/travel/countries'
        ? jsonResponse(countries)
        : url.includes('/cities')
          ? jsonResponse([])
          : jsonResponse({}, 404),
    );
    render(<TransportForm trip={planTrip} onSaved={() => {}} />);

    fireEvent.change(await screen.findByLabelText('起点 国家'), {
      target: { value: 'c1' },
    });
    fireEvent.change(screen.getByLabelText('终点 国家'), {
      target: { value: 'c1' },
    });

    expect(await screen.findByText('起点和终点不能相同')).toBeTruthy();
    expect((screen.getByRole('button', { name: '添加' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows TIME_ORDER_INVALID hint when planned arrival is before departure', async () => {
    stubFetch((url) =>
      url === '/api/travel/countries'
        ? jsonResponse(countries)
        : url.includes('/cities')
          ? jsonResponse([])
          : jsonResponse({}, 404),
    );
    render(<TransportForm trip={planTrip} onSaved={() => {}} />);

    fireEvent.change(await screen.findByLabelText('起点 国家'), {
      target: { value: 'c1' },
    });
    fireEvent.change(screen.getByLabelText('终点 国家'), {
      target: { value: 'c2' },
    });
    fireEvent.change(screen.getByLabelText('计划出发'), {
      target: { value: '2026-12-01T10:00' },
    });
    fireEvent.change(screen.getByLabelText('计划到达'), {
      target: { value: '2026-12-01T09:00' },
    });

    expect(await screen.findByText('到达时间不能早于出发时间')).toBeTruthy();
    expect((screen.getByRole('button', { name: '添加' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits valid payload and calls onSaved', async () => {
    const onSaved = vi.fn();
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/travel/countries') return jsonResponse(countries);
      if (url.includes('/cities')) return jsonResponse([]);
      if (url === '/api/travel/trips/t1/transports' && init?.method === 'POST') {
        return jsonResponse({ id: 'tr1' }, 201);
      }
      return jsonResponse({}, 404);
    });
    render(<TransportForm trip={planTrip} onSaved={onSaved} />);

    fireEvent.change(await screen.findByLabelText('起点 国家'), {
      target: { value: 'c1' },
    });
    fireEvent.change(screen.getByLabelText('终点 国家'), {
      target: { value: 'c2' },
    });
    fireEvent.change(screen.getByLabelText('计划出发'), {
      target: { value: '2026-12-01T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const postCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === '/api/travel/trips/t1/transports' &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.origin).toEqual({ level: 'COUNTRY', id: 'c1' });
    expect(body.destination).toEqual({ level: 'COUNTRY', id: 'c2' });
    expect(body.syncToCalendar).toBe(true);
    expect(typeof body.plannedDepartureAt).toBe('string');
  });
});

describe('TransportForm language switching', () => {
  it('renders validation hints in the selected language', async () => {
    stubFetch((url) =>
      url === '/api/travel/countries'
        ? jsonResponse(countries)
        : url.includes('/cities')
          ? jsonResponse([])
          : jsonResponse({}, 404),
    );
    render(<TransportForm trip={planTrip} onSaved={() => {}} />);

    fireEvent.change(await screen.findByLabelText('起点 国家'), {
      target: { value: 'c1' },
    });
    fireEvent.change(screen.getByLabelText('终点 国家'), {
      target: { value: 'c1' },
    });
    expect(await screen.findByText('起点和终点不能相同')).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'en' } }),
    );
    expect(await screen.findByText('Origin and destination must be different')).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'de' } }),
    );
    expect(
      await screen.findByText('Start und Ziel dürfen nicht identisch sein'),
    ).toBeTruthy();
  });
});
