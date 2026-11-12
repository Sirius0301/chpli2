import type { DisplayMemoInstance } from './view-model';

/**
 * Browser notification capability (M4 D3): everything degrades silently to
 * the due card + badges when notifications are unsupported or denied.
 */
export type NotificationSupport = 'unsupported' | 'denied' | 'default' | 'granted';

interface NotificationCtor {
  permission: string;
  requestPermission?: () => Promise<string>;
}

function ctorOf(globalLike: unknown): NotificationCtor | null {
  const c = (globalLike as { Notification?: NotificationCtor } | null)?.Notification;
  return c && typeof c.permission === 'string' ? c : null;
}

export function notificationSupport(globalLike: unknown = globalThis): NotificationSupport {
  const ctor = ctorOf(globalLike);
  if (!ctor) return 'unsupported';
  if (ctor.permission === 'granted') return 'granted';
  if (ctor.permission === 'denied') return 'denied';
  return 'default';
}

/** Requests permission (user gesture required); resolves to the new state. */
export async function requestNotificationPermission(
  globalLike: unknown = globalThis,
): Promise<NotificationSupport> {
  const ctor = ctorOf(globalLike);
  if (!ctor?.requestPermission) return 'unsupported';
  try {
    await ctor.requestPermission();
  } catch {
    /* some platforms throw instead of resolving a state */
  }
  return notificationSupport(globalLike);
}

// -- Session-scoped "already notified" set (M4 D2/D4) -----------------------

const NOTIFIED_STORAGE_KEY = 'chpli2-notified-instances';

function readNotified(storage: Storage): Set<string> {
  try {
    const raw = storage.getItem(NOTIFIED_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function hasNotified(storage: Storage, key: string): boolean {
  return readNotified(storage).has(key);
}

export function markNotified(storage: Storage, key: string): void {
  const set = readNotified(storage);
  set.add(key);
  try {
    storage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* storage full/unavailable: dedup just won't survive */
  }
}

/** Instances due today that this session has not notified yet. */
export function pendingNotifications(
  instances: DisplayMemoInstance[],
  todayKey: string,
  storage: Storage,
): DisplayMemoInstance[] {
  return instances.filter(
    (i) => !i.completed && i.date === todayKey && !hasNotified(storage, i.key),
  );
}
