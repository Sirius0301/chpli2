/**
 * Portal bridge protocol (M5). CHPLI runs as a Portal sub-application in an
 * iframe; session handoff and navigation go through postMessage with an
 * origin whitelist. The full protocol is a CHPLI-side minimal convention —
 * pending confirmation with the Portal team (M5 D-records).
 */

export const PORTAL_MESSAGE_SOURCE = 'chpli2';

export const PORTAL_MESSAGE_TYPES = {
  /** CHPLI -> Portal: handshake ping after detecting a parent frame. */
  READY: 'chpli:portal:ready',
  /** Portal -> CHPLI: session grant or update. */
  INIT: 'chpli:portal:init',
  /** Portal -> CHPLI: the Portal session ended. */
  PORTAL_LOGOUT: 'chpli:portal:logout',
  /** CHPLI -> Portal: CHPLI has no valid session; show the Portal login UI. */
  LOGIN_REQUEST: 'chpli:portal:login-request',
  /** CHPLI -> Portal: the user asked to sign out from within CHPLI. */
  LOGOUT: 'chpli:portal:logout',
  /** CHPLI -> Portal: navigate the Portal shell (e.g. back to home). */
  NAVIGATE: 'chpli:portal:navigate',
} as const;

export type PortalMessageType = (typeof PORTAL_MESSAGE_TYPES)[keyof typeof PORTAL_MESSAGE_TYPES];

/** Minimal user shape the Portal hands over at session grant. */
export interface PortalUser {
  id: string;
  username: string;
}

interface PortalMessageBase {
  source: typeof PORTAL_MESSAGE_SOURCE;
  type: PortalMessageType;
}

export interface PortalReadyMessage extends PortalMessageBase {
  type: typeof PORTAL_MESSAGE_TYPES.READY;
}

export interface PortalInitMessage extends PortalMessageBase {
  type: typeof PORTAL_MESSAGE_TYPES.INIT;
  token: string;
  user: PortalUser;
}

export interface PortalLogoutSignalMessage extends PortalMessageBase {
  type: typeof PORTAL_MESSAGE_TYPES.PORTAL_LOGOUT;
}

export interface PortalLoginRequestMessage extends PortalMessageBase {
  type: typeof PORTAL_MESSAGE_TYPES.LOGIN_REQUEST;
}

export interface PortalLogoutMessage extends PortalMessageBase {
  type: typeof PORTAL_MESSAGE_TYPES.LOGOUT;
}

export interface PortalNavigateMessage extends PortalMessageBase {
  type: typeof PORTAL_MESSAGE_TYPES.NAVIGATE;
  target: 'home';
}

export type PortalMessage =
  | PortalReadyMessage
  | PortalInitMessage
  | PortalLogoutSignalMessage
  | PortalLoginRequestMessage
  | PortalLogoutMessage
  | PortalNavigateMessage;

export function isPortalMessage(value: unknown): value is PortalMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  if (msg.source !== PORTAL_MESSAGE_SOURCE) return false;
  switch (msg.type) {
    case PORTAL_MESSAGE_TYPES.READY:
    case PORTAL_MESSAGE_TYPES.PORTAL_LOGOUT:
    case PORTAL_MESSAGE_TYPES.LOGIN_REQUEST:
    case PORTAL_MESSAGE_TYPES.LOGOUT:
      return true;
    case PORTAL_MESSAGE_TYPES.INIT:
      return (
        typeof msg.token === 'string' &&
        msg.token.length > 0 &&
        typeof msg.user === 'object' &&
        msg.user !== null &&
        typeof (msg.user as Record<string, unknown>).id === 'string' &&
        typeof (msg.user as Record<string, unknown>).username === 'string'
      );
    case PORTAL_MESSAGE_TYPES.NAVIGATE:
      return msg.target === 'home';
    default:
      return false;
  }
}

/** Outbound message factory — always stamps the protocol source. */
export function portalMessage<T extends PortalMessage>(message: T): T {
  return { ...message, source: PORTAL_MESSAGE_SOURCE };
}
