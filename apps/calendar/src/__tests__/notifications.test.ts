import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasNotified,
  markNotified,
  notificationSupport,
  pendingNotifications,
  requestNotificationPermission,
} from '../notifications';
import type { DisplayMemoInstance } from '../view-model';

const TODAY = '2026-11-12';

function inst(memoId: string, date: string, completed = false): DisplayMemoInstance {
  return {
    key: `${memoId}:${date}`,
    memoId,
    date,
    title: memoId,
    priority: 'none',
    repeat: 'none',
    completed,
    tags: [],
    source: {} as DisplayMemoInstance['source'],
  };
}

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

function globalWith(permission?: string) {
  return permission === undefined
    ? {}
    : { Notification: { permission, requestPermission: async () => 'granted' } };
}

describe('notificationSupport (M4 D3)', () => {
  it('reports unsupported when the API is missing (e.g. some WebViews)', () => {
    expect(notificationSupport({})).toBe('unsupported');
    expect(notificationSupport(null)).toBe('unsupported');
  });

  it('maps permission states', () => {
    expect(notificationSupport(globalWith('granted'))).toBe('granted');
    expect(notificationSupport(globalWith('denied'))).toBe('denied');
    expect(notificationSupport(globalWith('default'))).toBe('default');
  });
});

describe('requestNotificationPermission', () => {
  it('resolves to the resulting state and tolerates throwing platforms', async () => {
    // Browsers update the static permission property after a request.
    const target = { permission: 'default', requestPermission: async () => 'granted' };
    target.requestPermission = async () => {
      target.permission = 'granted';
      return 'granted';
    };
    expect(await requestNotificationPermission({ Notification: target })).toBe('granted');
    const throwing = { Notification: { permission: 'default', requestPermission: async () => { throw new Error('nope'); } } };
    expect(await requestNotificationPermission(throwing)).toBe('default');
    expect(await requestNotificationPermission({})).toBe('unsupported');
  });
});

describe('session dedup (M4 D2/D4, E68)', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = mockStorage();
  });

  it('marks and remembers notified instance keys', () => {
    expect(hasNotified(storage, 'a:2026-11-12')).toBe(false);
    markNotified(storage, 'a:2026-11-12');
    expect(hasNotified(storage, 'a:2026-11-12')).toBe(true);
    expect(hasNotified(storage, 'b:2026-11-12')).toBe(false);
  });

  it('pendingNotifications returns only unnotified instances due today', () => {
    const instances = [
      inst('a', TODAY),
      inst('b', TODAY),
      inst('c', '2026-11-13'), // tomorrow: no notification (D7)
      inst('d', TODAY, true), // completed
    ];
    markNotified(storage, 'b:2026-11-12');
    const pending = pendingNotifications(instances, TODAY, storage);
    expect(pending.map((i) => i.memoId)).toEqual(['a']);
    // The caller marks after showing; then nothing remains for this session.
    markNotified(storage, 'a:2026-11-12');
    expect(pendingNotifications(instances, TODAY, storage)).toEqual([]);
  });
});
