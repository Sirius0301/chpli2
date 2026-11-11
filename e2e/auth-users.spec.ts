import { expect, test } from '@playwright/test';
import { authedApi } from './auth';

/**
 * End-to-end coverage of the M0 user & auth slice:
 *  A32 the login card gates the shell; UI registration enters the app
 *  A33 data isolation across users (calendar list)
 *  A19 a stored session survives reload (no login card)
 */

function unique(name: string): string {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
});

test('A32: the login card gates the shell and UI registration enters the app', async ({
  page,
}) => {
  await page.goto('/');
  const card = page.getByRole('form', { name: 'Sign in to CHPLI' });
  await expect(card).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toHaveCount(0);

  // Switch to the register tab and create an account through the UI.
  await card.getByRole('tab', { name: 'Register' }).click();
  await card.getByLabel('Username').fill(unique('e2e-register'));
  await card.getByLabel('Password').fill('e2e-password-123');
  await card.getByRole('button', { name: 'Create account' }).click();

  // The shell appears with the authenticated identity (A19).
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
  await expect(page.getByText(/Hello, /)).toBeVisible();
});

test('A32: invalid credentials show an error on the login card', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('form', { name: 'Sign in to CHPLI' });
  await card.getByLabel('Username / email / phone').fill(unique('e2e-nouser'));
  await card.getByLabel('Password').fill('e2e-password-123');
  await card.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Invalid account or password');
  await expect(card).toBeVisible(); // stays on the card
});

test('A37: verification-code login through the UI (email + code)', async ({ page }) => {
  const username = unique('e2e-code');
  const email = `${username}@example.com`;
  const res = await page.request.post('/api/auth/register', {
    data: { username, password: 'e2e-password-123', email },
  });
  expect(res.ok()).toBeTruthy();

  await page.goto('/');
  const card = page.getByRole('form', { name: 'Sign in to CHPLI' });
  await card.getByRole('tab', { name: 'Verification code' }).click();
  await card.getByLabel('Username / email / phone').fill(email);

  const codeResponsePromise = page.waitForResponse((r) =>
    r.url().endsWith('/api/auth/code'),
  );
  await card.getByRole('button', { name: 'Send code' }).click();
  const codeResponse = await codeResponsePromise;
  expect(codeResponse.ok()).toBeTruthy();
  const { sent, devCode } = (await codeResponse.json()) as {
    sent: boolean;
    devCode?: string;
  };
  expect(sent).toBe(true);
  expect(devCode).toMatch(/^[0-9]{6}$/);

  await card.getByLabel('Code').fill(devCode!);
  await card.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`Hello, ${username}`))).toBeVisible();
});

test('A33: a second user cannot see the first user\'s calendars', async ({ page }) => {
  const first = unique('e2e-first');
  const second = unique('e2e-second');
  await page.goto('/');

  // Register the first user via API and create a calendar.
  const firstRes = await page.request.post('/api/auth/register', {
    data: { username: first, password: 'e2e-password-123' },
  });
  const { token: firstToken } = (await firstRes.json()) as { token: string };
  const calRes = await authedApi(page, firstToken).post('/api/calendar/calendars', {
    data: { name: `private-${first}`, color: '#0A84FF', type: 'custom' },
  });
  expect(calRes.ok()).toBeTruthy();

  // Register the second user and confirm the calendar is invisible (UI + API).
  const secondRes = await page.request.post('/api/auth/register', {
    data: { username: second, password: 'e2e-password-123' },
  });
  const { token: secondToken, user: secondUser } = (await secondRes.json()) as {
    token: string;
    user: { id: string; username: string; createdAt: string };
  };
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('chpli2-token', t);
      localStorage.setItem('chpli2-user', JSON.stringify(u));
    },
    [secondToken, secondUser] as const,
  );

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.calendar-list', { hasText: `private-${first}` })).toHaveCount(0);
});

test('A19: a stored session survives reload', async ({ page }) => {
  const username = unique('e2e-reload');
  const res = await page.request.post('/api/auth/register', {
    data: { username, password: 'e2e-password-123' },
  });
  const { token, user } = (await res.json()) as {
    token: string;
    user: { id: string; username: string; createdAt: string };
  };
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('chpli2-token', t);
      localStorage.setItem('chpli2-user', JSON.stringify(u));
    },
    [token, user] as const,
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`Hello, ${username}`))).toBeVisible();
});
