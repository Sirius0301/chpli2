import { describe, expect, it, vi } from 'vitest';
import {
  createPortalBridge,
  isAllowedOrigin,
  type PortalBridgeCallbacks,
} from '../portal/bridge';
import {
  PORTAL_MESSAGE_SOURCE,
  PORTAL_MESSAGE_TYPES,
  type PortalInitMessage,
} from '@chpli2/shared';

/** Minimal Window stand-in good enough for the bridge. */
function fakeWindow({ parent = null as unknown, origin = 'http://localhost:3000' } = {}) {
  const listeners: ((event: MessageEvent) => void)[] = [];
  const posted: { message: unknown; targetOrigin: string }[] = [];
  const win = {
    parent: parent ?? null,
    location: { origin },
    addEventListener: (_type: string, fn: (event: MessageEvent) => void) => listeners.push(fn),
    removeEventListener: (_type: string, fn: (event: MessageEvent) => void) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
    postToParent(message: unknown, origin = 'http://localhost:3000') {
      for (const fn of [...listeners]) {
        fn({ source: win.parent, origin, data: message } as MessageEvent);
      }
    },
  };
  const parentFrame = {
    postMessage: (message: unknown, targetOrigin: string) => {
      posted.push({ message, targetOrigin });
    },
  };
  if (parent === undefined || parent === null) {
    // no parent reference: emulate standalone via parent === win
    win.parent = win;
  } else {
    win.parent = parentFrame;
  }
  return { win, parentFrame, posted };
}

function callbacks(): PortalBridgeCallbacks & { init: unknown[]; logout: number } {
  const tracker = { init: [] as unknown[], logout: 0 };
  return {
    get init() {
      return tracker.init;
    },
    get logout() {
      return tracker.logout;
    },
    onInit: (m: unknown) => tracker.init.push(m),
    onPortalLogout: () => {
      tracker.logout += 1;
    },
  };
}

const INIT: PortalInitMessage = {
  source: PORTAL_MESSAGE_SOURCE,
  type: PORTAL_MESSAGE_TYPES.INIT,
  token: 'jwt',
  user: { id: 'u1', username: 'ada' },
};

describe('isAllowedOrigin (M5 D3/E71)', () => {
  it('allows same-origin and whitelisted origins only', () => {
    expect(isAllowedOrigin('http://localhost:3000', 'http://localhost:3000', [])).toBe(true);
    expect(isAllowedOrigin('https://portal.example.com', 'http://localhost:3000', [])).toBe(false);
    expect(
      isAllowedOrigin('https://portal.example.com', 'http://localhost:3000', [
        'https://portal.example.com',
      ]),
    ).toBe(true);
  });
});

describe('createPortalBridge', () => {
  it('is standalone without a parent frame (E76)', async () => {
    const { win } = fakeWindow();
    const bridge = createPortalBridge(win as unknown as Window, callbacks());
    expect(await bridge.ready).toBe('standalone');
    expect(bridge.mode).toBe('standalone');
  });

  it('falls back to standalone when the handshake times out (E74)', async () => {
    const { win } = fakeWindow({ parent: {} });
    const cb = callbacks();
    let fired: (() => void) | undefined;
    const bridge = createPortalBridge(win as unknown as Window, cb, {
      timeoutMs: 5,
      setTimer: (fn) => {
        fired = fn as () => void;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {},
    });
    expect(bridge.mode).toBe('standalone'); // until proven otherwise
    fired!();
    expect(await bridge.ready).toBe('standalone');
    expect(cb.init).toHaveLength(0);
  });

  it('enters portal mode on init and exposes the outbound verbs', async () => {
    const { win, posted } = fakeWindow({ parent: {} });
    const cb = callbacks();
    const bridge = createPortalBridge(win as unknown as Window, cb, { timeoutMs: 1000 });
    expect(posted[0]?.message).toMatchObject({ type: PORTAL_MESSAGE_TYPES.READY });

    win.postToParent(INIT);
    expect(await bridge.ready).toBe('portal');
    expect(bridge.mode).toBe('portal');
    expect(cb.init).toHaveLength(1);

    bridge.goHome();
    bridge.notifyLogout();
    bridge.requestLogin();
    expect(posted.slice(1).map((p) => (p.message as { type: string }).type)).toEqual([
      PORTAL_MESSAGE_TYPES.NAVIGATE,
      PORTAL_MESSAGE_TYPES.LOGOUT,
      PORTAL_MESSAGE_TYPES.LOGIN_REQUEST,
    ]);
  });

  it('answers to the parent origin once known', async () => {
    const { win, posted } = fakeWindow({ parent: {} });
    const bridge = createPortalBridge(win as unknown as Window, callbacks(), {
      timeoutMs: 1000,
      whitelist: ['https://portal.example.com'],
    });
    win.postToParent(INIT, 'https://portal.example.com');
    await bridge.ready;
    bridge.goHome();
    expect(posted.at(-1)?.targetOrigin).toBe('https://portal.example.com');
  });

  it('ignores messages from non-whitelisted origins (E71)', async () => {
    const { win } = fakeWindow({ parent: {} });
    const cb = callbacks();
    const bridge = createPortalBridge(win as unknown as Window, cb, {
      timeoutMs: 1000,
      whitelist: ['https://portal.example.com'],
    });
    win.postToParent(INIT, 'https://evil.example.com');
    expect(cb.init).toHaveLength(0);
    win.postToParent(INIT, 'https://portal.example.com');
    expect(cb.init).toHaveLength(1);
    expect(bridge.mode).toBe('portal');
  });

  it('ignores malformed payloads (E72)', async () => {
    const { win } = fakeWindow({ parent: {} });
    const cb = callbacks();
    const bridge = createPortalBridge(win as unknown as Window, cb, { timeoutMs: 1000 });
    win.postToParent({ source: PORTAL_MESSAGE_SOURCE, type: PORTAL_MESSAGE_TYPES.INIT });
    win.postToParent({ source: 'evil', type: PORTAL_MESSAGE_TYPES.INIT, token: 'x', user: { id: 'u', username: 'a' } });
    expect(cb.init).toHaveLength(0);
    expect(bridge.mode).toBe('standalone');
  });

  it('portal logout signal switches to portal mode and fires the callback (E75)', async () => {
    const { win } = fakeWindow({ parent: {} });
    const cb = callbacks();
    const bridge = createPortalBridge(win as unknown as Window, cb, { timeoutMs: 1000 });
    win.postToParent({ source: PORTAL_MESSAGE_SOURCE, type: PORTAL_MESSAGE_TYPES.PORTAL_LOGOUT });
    expect(await bridge.ready).toBe('portal');
    expect(cb.logout).toBe(1);
  });

  it('outbound verbs are no-ops in standalone mode (E76)', async () => {
    const { win, posted } = fakeWindow();
    const bridge = createPortalBridge(win as unknown as Window, callbacks());
    await bridge.ready;
    bridge.goHome();
    bridge.notifyLogout();
    bridge.requestLogin();
    expect(posted).toHaveLength(0);
    expect(vi.fn()).not.toHaveBeenCalled;
  });
});
