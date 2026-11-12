import {
  isPortalMessage,
  portalMessage,
  PORTAL_MESSAGE_TYPES,
  type PortalInitMessage,
} from '@chpli2/shared';

/**
 * Portal bridge (M5). Detects a Portal parent frame, performs the postMessage
 * handshake and exposes the outbound verbs. Inbound messages pass an origin
 * whitelist (same-origin always allowed, plus PORTAL_ORIGINS); everything
 * else is ignored (E71). Protocol pending confirmation with the Portal team.
 */

export type PortalMode = 'standalone' | 'portal';

export interface PortalBridge {
  mode: PortalMode;
  /** CHPLI has no valid session: ask the Portal to show its login UI. */
  requestLogin(): void;
  /** The user signed out from within CHPLI. */
  notifyLogout(): void;
  /** Ask the Portal shell to navigate (back to home). */
  goHome(): void;
}

export const PORTAL_HANDSHAKE_TIMEOUT_MS = 500;

/** Comma-separated extra origins allowed to talk to CHPLI (M5 D3). */
export function portalOriginWhitelist(): string[] {
  const raw = process.env.PORTAL_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string, locationOrigin: string, whitelist: string[]): boolean {
  return origin === locationOrigin || whitelist.includes(origin);
}

export interface PortalBridgeCallbacks {
  /** Session granted or updated by the Portal. */
  onInit: (message: PortalInitMessage) => void;
  /** The Portal announced the session ended. */
  onPortalLogout: () => void;
}

interface BridgeOptions {
  timeoutMs?: number;
  whitelist?: string[];
  /** Injectable clock for tests. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/**
 * Creates the bridge. When this window has no parent (standalone), or the
 * handshake times out (E74), the bridge reports 'standalone' and never
 * touches the callbacks again.
 */
export function createPortalBridge(
  win: Window,
  callbacks: PortalBridgeCallbacks,
  options: BridgeOptions = {},
): PortalBridge & { ready: Promise<PortalMode> } {
  const timeoutMs = options.timeoutMs ?? PORTAL_HANDSHAKE_TIMEOUT_MS;
  const whitelist = options.whitelist ?? portalOriginWhitelist();

  if (win.parent === win) {
    const standalone: PortalBridge = {
      mode: 'standalone',
      requestLogin() {},
      notifyLogout() {},
      goHome() {},
    };
    return { ...standalone, ready: Promise.resolve('standalone' as PortalMode) };
  }

  let mode: PortalMode = 'standalone';
  let parentOrigin: string | null = null;

  const post = (message: unknown) => {
    win.parent.postMessage(message, parentOrigin ?? '*');
  };

  const onMessage = (event: MessageEvent) => {
    if (event.source !== win.parent) return;
    if (!isAllowedOrigin(event.origin, win.location.origin, whitelist)) return;
    if (!isPortalMessage(event.data)) return;
    parentOrigin = event.origin;
    if (event.data.type === PORTAL_MESSAGE_TYPES.INIT) {
      mode = 'portal';
      callbacks.onInit(event.data);
    } else if (event.data.type === PORTAL_MESSAGE_TYPES.PORTAL_LOGOUT) {
      mode = 'portal';
      callbacks.onPortalLogout();
    }
  };

  win.addEventListener('message', onMessage);
  post(portalMessage({ source: 'chpli2', type: PORTAL_MESSAGE_TYPES.READY }));

  const setTimer =
    options.setTimer ?? (((fn: () => void, ms: number) => setTimeout(fn, ms)) as (fn: () => void, ms: number) => unknown);
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let settled = false;
  const ready = new Promise<PortalMode>((resolve) => {
    const timer = setTimer(() => {
      if (!settled) {
        settled = true;
        // E74: never heard back — behave exactly as standalone.
        win.removeEventListener('message', onMessage);
        resolve('standalone');
      }
    }, timeoutMs);
    const mark = (m: PortalMode) => {
      if (!settled) {
        settled = true;
        clearTimer(timer);
        resolve(m);
      }
    };
    const wrappedInit = callbacks.onInit;
    callbacks.onInit = (m) => {
      mark('portal');
      wrappedInit(m);
    };
    const wrappedLogout = callbacks.onPortalLogout;
    callbacks.onPortalLogout = () => {
      mark('portal');
      wrappedLogout();
    };
  });

  return {
    get mode() {
      return mode;
    },
    requestLogin() {
      if (mode === 'portal') post(portalMessage({ source: 'chpli2', type: PORTAL_MESSAGE_TYPES.LOGIN_REQUEST }));
    },
    notifyLogout() {
      if (mode === 'portal') post(portalMessage({ source: 'chpli2', type: PORTAL_MESSAGE_TYPES.LOGOUT }));
    },
    goHome() {
      if (mode === 'portal')
        post(portalMessage({ source: 'chpli2', type: PORTAL_MESSAGE_TYPES.NAVIGATE, target: 'home' }));
    },
    ready,
  };
}
