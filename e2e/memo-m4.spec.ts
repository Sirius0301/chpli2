import { expect, test, type Page } from '@playwright/test';
import { signIn } from './auth';

/**
 * End-to-end coverage of the M4 due-soon slice:
 *  1. Due card + month-view badge + week-view dot for an uncompleted memo
 *     due today; completing it clears all of them (A59/A60/E69).
 *  2. Browser notification: a recording Notification stub stands in for the
 *     headless browser (which has no notification UI); the app must fire
 *     exactly one notification per due instance per session, including
 *     across reloads (A61/E68). Simulated via Playwright init script —
 *     reported as simulation, not a real OS notification.
 *  3. Degradation: without granted permission the app stays fully usable
 *     and offers no permission prompt (E65/E66).
 */

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const chip = (page: Page, title: string) => page.locator('.memo-chip', { hasText: title });

async function createDueTodayMemo(page: Page, title: string, token: string): Promise<void> {
  const today = new Date();
  const res = await page.request.post('/api/memos', {
    headers: { Authorization: `Bearer ${token}` },
    data: { id: crypto.randomUUID(), title, date: dayKey(today) },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

async function openCalendar(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
}

/**
 * Installs a recording Notification stub before any page script runs. The
 * record lives in localStorage so it survives reloads within the test (a
 * window-level array would be reset when the init script re-runs).
 */
const STUB_STORAGE_KEY = '__m4_notify_stub';

function notificationStubInitScript(page: Page): void {
  void page.addInitScript((storageKey) => {
    class FakeNotification {
      static permission = 'granted';
      static async requestPermission() {
        return 'granted';
      }
      onclick: (() => void) | null = null;
      constructor(title: string, options?: { body?: string }) {
        const raw = localStorage.getItem(storageKey);
        const shows: { title: string; body?: string }[] = raw ? JSON.parse(raw) : [];
        shows.push({ title, body: options?.body });
        localStorage.setItem(storageKey, JSON.stringify(shows));
      }
    }
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
  }, STUB_STORAGE_KEY);
}

async function notifiedShows(page: Page): Promise<{ title: string; body?: string }[]> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as { title: string; body?: string }[]) : [];
  }, STUB_STORAGE_KEY);
}

test('due card, badges and completing the instance clears them (A59/A60/E69)', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  const token = await signIn(page, `e2e-m4-${Date.now()}-a`);
  await createDueTodayMemo(page, 'M4-due-today', token);

  await openCalendar(page);

  // Sidebar due card lists the instance as due today.
  const card = page.getByTestId('due-card');
  const entry = card.locator('.memo-due__item', { hasText: 'M4-due-today' });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('Today');

  // Week view: red dot on today's column header only.
  await expect(page.locator('.day-col__due-dot')).toHaveCount(1);

  // Month view: 今 badge on today's cell only.
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  const badge = page.locator('.month-view__due-badge');
  await expect(badge).toHaveCount(1);
  const badgeDay = await badge
    .first()
    .evaluate((el) => el.closest('.month-view__cell')?.getAttribute('data-day'));
  expect(badgeDay).toBe(dayKey(new Date()));

  // Clicking the due card entry opens the instance editor and jumps to day view.
  await entry.click();
  await expect(page.getByRole('tab', { name: 'Day', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.detail-panel')).toBeVisible();

  // Complete the instance: card empties, badge and dot disappear (E69).
  await page.keyboard.press('Escape');
  await chip(page, 'M4-due-today').getByRole('checkbox').click();
  await expect(card).toContainText('Nothing due');
  await expect(page.locator('.month-view__due-badge')).toHaveCount(0);
});

test('browser notification fires once per due instance per session (A61/E68, simulated)', async ({
  browser,
}) => {
  // Fresh context so the stub owns window.Notification before app boot.
  const context = await browser.newContext();
  const page = await context.newPage();
  notificationStubInitScript(page);
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));

  const token = await signIn(page, `e2e-m4-${Date.now()}-b`);
  await createDueTodayMemo(page, 'M4-notify-me', token);
  await openCalendar(page);

  // Exactly one notification for the due instance (patient poll: cold
  // module-federation boot can take a few seconds).
  await expect
    .poll(async () => (await notifiedShows(page)).length, { timeout: 20_000 })
    .toBe(1);
  const first = (await notifiedShows(page))[0]!;
  expect(first.title).toBe('Memo due');
  expect(first.body).toContain('M4-notify-me');

  // Reload (same session): no duplicate notification (E68).
  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(chipStable(page)).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await notifiedShows(page)).length).toBe(1);

  // Completing the instance must not re-notify.
  await chip(page, 'M4-notify-me').getByRole('checkbox').click();
  await page.waitForTimeout(1500);
  expect((await notifiedShows(page)).length).toBe(1);

  await context.close();
});

function chipStable(page: Page) {
  return page.getByTestId('due-card').locator('.memo-due__item', { hasText: 'M4-notify-me' });
}

test('degrades silently without notification permission (E65/E66)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  const token = await signIn(page, `e2e-m4-${Date.now()}-c`);
  await createDueTodayMemo(page, 'M4-no-permission', token);
  await openCalendar(page);

  // Headless Chromium reports permission 'denied': no enable button, no crash.
  const card = page.getByTestId('due-card');
  await expect(card.locator('.memo-due__item', { hasText: 'M4-no-permission' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Enable browser notifications' })).toHaveCount(0);
  await expect(page.locator('.day-col__due-dot')).toHaveCount(1);
});
