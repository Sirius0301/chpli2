import { describe, expect, it } from 'vitest';
import {
  isPortalMessage,
  PORTAL_MESSAGE_SOURCE,
  PORTAL_MESSAGE_TYPES,
  portalMessage,
  type PortalInitMessage,
} from '../src/portal.js';

describe('portal protocol guards (M5 D7)', () => {
  it('accepts a well-formed init message', () => {
    const msg: PortalInitMessage = {
      source: PORTAL_MESSAGE_SOURCE,
      type: PORTAL_MESSAGE_TYPES.INIT,
      token: 'jwt',
      user: { id: 'u1', username: 'ada' },
    };
    expect(isPortalMessage(msg)).toBe(true);
  });

  it('accepts the no-payload message types', () => {
    for (const type of [
      PORTAL_MESSAGE_TYPES.READY,
      PORTAL_MESSAGE_TYPES.PORTAL_LOGOUT,
      PORTAL_MESSAGE_TYPES.LOGIN_REQUEST,
      PORTAL_MESSAGE_TYPES.LOGOUT,
    ]) {
      expect(isPortalMessage({ source: PORTAL_MESSAGE_SOURCE, type })).toBe(true);
    }
  });

  it('accepts navigate only with target home', () => {
    expect(
      isPortalMessage({ source: PORTAL_MESSAGE_SOURCE, type: PORTAL_MESSAGE_TYPES.NAVIGATE, target: 'home' }),
    ).toBe(true);
    expect(
      isPortalMessage({ source: PORTAL_MESSAGE_SOURCE, type: PORTAL_MESSAGE_TYPES.NAVIGATE, target: 'evil' }),
    ).toBe(false);
  });

  it('rejects malformed payloads (E72)', () => {
    expect(isPortalMessage(null)).toBe(false);
    expect(isPortalMessage('chpli:portal:init')).toBe(false);
    expect(isPortalMessage({ type: PORTAL_MESSAGE_TYPES.INIT })).toBe(false); // wrong/missing source
    expect(
      isPortalMessage({ source: PORTAL_MESSAGE_SOURCE, type: PORTAL_MESSAGE_TYPES.INIT }),
    ).toBe(false); // missing token/user
    expect(
      isPortalMessage({
        source: PORTAL_MESSAGE_SOURCE,
        type: PORTAL_MESSAGE_TYPES.INIT,
        token: '',
        user: { id: 'u1', username: 'ada' },
      }),
    ).toBe(false); // empty token
    expect(
      isPortalMessage({
        source: PORTAL_MESSAGE_SOURCE,
        type: PORTAL_MESSAGE_TYPES.INIT,
        token: 'jwt',
        user: { id: 'u1' },
      }),
    ).toBe(false); // missing username
    expect(isPortalMessage({ source: 'evil', type: PORTAL_MESSAGE_TYPES.READY })).toBe(false);
    expect(
      isPortalMessage({ source: PORTAL_MESSAGE_SOURCE, type: 'chpli:portal:unknown' }),
    ).toBe(false);
  });

  it('stamps outbound messages with the protocol source', () => {
    const ready = portalMessage({ source: PORTAL_MESSAGE_SOURCE, type: PORTAL_MESSAGE_TYPES.READY });
    expect(ready.source).toBe(PORTAL_MESSAGE_SOURCE);
    expect(ready.type).toBe(PORTAL_MESSAGE_TYPES.READY);
  });
});
