import { render, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import { vi } from 'vitest';

const TEST_USER = { id: 'u1', username: 'tester', createdAt: '2026-01-01T00:00:00.000Z' };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const bridgeCtl = vi.hoisted(() => ({ current: null as null | {
  mode: string;
  requestLogin: ReturnType<typeof vi.fn>;
  notifyLogout: ReturnType<typeof vi.fn>;
  goHome: ReturnType<typeof vi.fn>;
  ready: Promise<string>;
  simulateInit: (message: { token: string; user: unknown }) => void;
  simulatePortalLogout: () => void;
} }));

/** The Portal bridge is replaced by a controllable stub (Portal mode). */
vi.mock('../portal/bridge', () => ({
  createPortalBridge: (
    _win: unknown,
    callbacks: {
      onInit: (message: { token: string; user: unknown }) => void;
      onPortalLogout: () => void;
    },
  ) => {
    const api = {
      mode: 'portal',
      requestLogin: vi.fn(),
      notifyLogout: vi.fn(),
      goHome: vi.fn(),
      ready: Promise.resolve('portal'),
      simulateInit: (message: { token: string; user: unknown }) => callbacks.onInit(message),
      simulatePortalLogout: () => callbacks.onPortalLogout(),
    };
    bridgeCtl.current = api;
    return api;
  },
}));

function stubAuthApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return localStorage.getItem('chpli2-token') === 'tok'
          ? jsonResponse(TEST_USER)
          : jsonResponse(
              { statusCode: 401, message: 'unauthorized', errorCode: 'UNAUTHORIZED' },
              401,
            );
      }
      return jsonResponse({}, 404);
    }),
  );
}

beforeEach(async () => {
  localStorage.clear();
  bridgeCtl.current = null;
  stubAuthApi();
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Host shell in Portal mode (M5)', () => {
  it('enters the app via a Portal init (A64)', async () => {
    render(<App />);
    const bridge = bridgeCtl.current!;
    await waitFor(() => expect(bridge).not.toBeNull());

    bridge.simulateInit({ token: 'tok', user: { id: 'u1', username: 'tester' } });

    // fetchMe validates the granted token; the shell appears without any
    // local login card.
    expect(await screen.findByText(/你好，tester/)).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expect(screen.getByRole('button', { name: '返回首页' })).toBeTruthy();
    expect(localStorage.getItem('chpli2-token')).toBe('tok');
  });

  it('back-to-home asks the Portal to navigate (A65)', async () => {
    render(<App />);
    const bridge = bridgeCtl.current!;
    bridge.simulateInit({ token: 'tok', user: { id: 'u1', username: 'tester' } });
    await screen.findByText(/你好，tester/);

    screen.getByRole('button', { name: '返回首页' }).click();
    expect(bridge.goHome).toHaveBeenCalledTimes(1);
  });

  it('an invalid Portal token shows the waiting surface and asks Portal to log in (E73)', async () => {
    render(<App />);
    const bridge = bridgeCtl.current!;
    bridge.simulateInit({ token: 'bad-token', user: { id: 'u1', username: 'tester' } });

    expect(await screen.findByText('等待 Portal 登录…')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull(); // local login card never renders
    await waitFor(() => expect(bridge.requestLogin).toHaveBeenCalled());
    expect(localStorage.getItem('chpli2-token')).toBeNull();
  });

  it('a Portal logout signal shows the waiting surface (E75)', async () => {
    render(<App />);
    const bridge = bridgeCtl.current!;
    bridge.simulateInit({ token: 'tok', user: { id: 'u1', username: 'tester' } });
    await screen.findByText(/你好，tester/);

    bridge.simulatePortalLogout();
    expect(await screen.findByText('等待 Portal 登录…')).toBeTruthy();
  });

  it('signing out from CHPLI notifies the Portal (A67)', async () => {
    render(<App />);
    const bridge = bridgeCtl.current!;
    bridge.simulateInit({ token: 'tok', user: { id: 'u1', username: 'tester' } });
    await screen.findByText(/你好，tester/);

    screen.getByRole('button', { name: '登出' }).click();
    expect(bridge.notifyLogout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('等待 Portal 登录…')).toBeTruthy();
    expect(localStorage.getItem('chpli2-token')).toBeNull();
  });
});
