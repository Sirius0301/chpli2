import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end coverage of the M5 Portal integration against the same-origin
 * Portal simulator (apps/host/public/portal-simulator.html — a test harness,
 * not the real Portal):
 *  1. Handshake -> init grant -> CHPLI enters the app without a local login
 *     card (A64); cross-user session swap isolates data (A68).
 *  2. Back-to-home, logout and login-request postMessage verbs (A65/A67/E73).
 *  3. Portal logout signal -> waiting surface (E75).
 *  4. Standalone (no parent) behavior is unchanged — covered by every other
 *     e2e suite (A69).
 */

interface Session {
  token: string;
  user: { id: string; username: string; createdAt: string };
}

async function register(page: Page, tag: string): Promise<Session> {
  const res = await page.request.post('/api/auth/register', {
    data: { username: `e2e-m5-${tag}-${Date.now()}`, password: 'e2e-password-123' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as Session;
}

async function createMemo(page: Page, session: Session, title: string): Promise<void> {
  const pad = (v: number) => String(v).padStart(2, '0');
  const d = new Date();
  const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const res = await page.request.post('/api/memos', {
    headers: { Authorization: `Bearer ${session.token}` },
    data: { id: crypto.randomUUID(), title, date: key },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** Opens the simulator and loads the app with an auto-granted session. */
async function openSimulatorWithSession(
  page: Page,
  session: Session,
): Promise<{ app: ReturnType<Page['frameLocator']> }> {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  await page.goto('/portal-simulator.html');
  await page.evaluate((s) => {
    (window as unknown as { __autoGrant: unknown }).__autoGrant = s;
    (window as unknown as { __portal: { load(): void } }).__portal.load();
  }, session);
  const app = page.frameLocator('#app');
  await expect(app.getByText(`Hello, ${session.user.username}`)).toBeVisible();
  return { app };
}

test('Portal handshake grants the session and isolates data per user (A64/A68)', async ({
  page,
}) => {
  const alice = await register(page, 'alice');
  const bob = await register(page, 'bob');
  await createMemo(page, alice, 'M5-alice-memo');
  await createMemo(page, bob, 'M5-bob-memo');

  const { app } = await openSimulatorWithSession(page, alice);
  await app.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(app.locator('.memo-chip', { hasText: 'M5-alice-memo' })).toHaveCount(1);
  await expect(app.locator('.memo-chip', { hasText: 'M5-bob-memo' })).toHaveCount(0);
  // No local login card, and the Portal-mode home button is present.
  await expect(app.getByRole('form')).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Back to home' })).toBeVisible();

  // Portal swaps the session to Bob: Alice's data disappears, Bob's appears.
  await page.evaluate((s) => {
    (window as unknown as { __portal: { grant(t: string, u: unknown): void } }).__portal.grant(
      s.token,
      s.user,
    );
  }, bob);
  await expect(app.getByText(`Hello, ${bob.user.username}`)).toBeVisible();
  await app.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(app.locator('.memo-chip', { hasText: 'M5-bob-memo' })).toHaveCount(1);
  await expect(app.locator('.memo-chip', { hasText: 'M5-alice-memo' })).toHaveCount(0);
});

test('back-to-home, logout and login-request drive the Portal (A65/A67/E73)', async ({ page }) => {
  const alice = await register(page, 'verbs');
  const { app } = await openSimulatorWithSession(page, alice);

  // A65: back to home posts navigate.
  await app.getByRole('button', { name: 'Back to home' }).click();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (window as unknown as { __messages: { type: string }[] }).__messages.map((m) => m.type),
      ),
    )
    .toContain('chpli:portal:navigate');

  // A67: sign out from CHPLI posts logout and shows the waiting surface.
  await app.getByRole('button', { name: 'Sign out' }).click();
  await expect(app.getByText('Waiting for Portal sign-in…')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (window as unknown as { __messages: { type: string }[] }).__messages.map((m) => m.type),
      ),
    )
    .toContain('chpli:portal:logout');

  // E73: granting an invalid token asks the Portal to log in.
  await page.evaluate(() => {
    const portal = (window as unknown as { __portal: { grant(t: string, u: unknown): void } })
      .__portal;
    portal.grant('not-a-valid-token', { id: 'x', username: 'x' });
  });
  await expect(app.getByText('Waiting for Portal sign-in…')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (window as unknown as { __messages: { type: string }[] }).__messages.map((m) => m.type),
      ),
    )
    .toContain('chpli:portal:login-request');

  // Re-login: a fresh valid grant recovers the app (E73 recovery path).
  await page.evaluate((s) => {
    (window as unknown as { __portal: { grant(t: string, u: unknown): void } }).__portal.grant(
      s.token,
      s.user,
    );
  }, alice);
  await expect(app.getByText(`Hello, ${alice.user.username}`)).toBeVisible();
});

test('a Portal logout signal shows the waiting surface (E75)', async ({ page }) => {
  const alice = await register(page, 'signal');
  const { app } = await openSimulatorWithSession(page, alice);

  await page.evaluate(() => {
    (window as unknown as { __portal: { logoutSignal(): void } }).__portal.logoutSignal();
  });
  await expect(app.getByText('Waiting for Portal sign-in…')).toBeVisible();
  await expect(app.getByRole('form')).toHaveCount(0); // never the local card
});
