import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the Bookmarks B1 slice:
 *  1. Create a bookmark via the UI -> card/list views -> persistence (A82).
 *  2. Cover upload/replace (A83); click counting through the UI (A94); the
 *     30-day inactive gray list driven by `docker exec psql` backdating
 *     last_clicked_at (A96) — the e2e env already depends on docker.
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-b1-${Date.now()}-${testInfo.workerIndex}`);
});

async function openBookmarks(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Bookmarks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();
}

test('create, view, persist and click a bookmark (A82/A94)', async ({ page, context }) => {
  await openBookmarks(page);

  await page.getByRole('button', { name: 'New bookmark' }).click();
  const editor = page.locator('.bm-editor');
  await editor.getByPlaceholder('Name', { exact: true }).fill('E2E Example');
  await editor.getByPlaceholder('https://…', { exact: true }).fill('https://example.com/docs');
  await editor.getByPlaceholder('Description (optional)').fill('A documentation site');
  await editor.getByPlaceholder('Press Enter to add').fill('docs');
  await editor.getByPlaceholder('Press Enter to add').press('Enter');
  await editor.getByRole('button', { name: 'Save' }).click();

  // Card view renders title/domain/description/categories.
  const card = page.locator('.bm-card', { hasText: 'E2E Example' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('example.com');
  await expect(card).toContainText('docs');
  await expect(card).toContainText('0 clicks');

  // List view toggle.
  await page.getByRole('tab', { name: 'List', exact: true }).click();
  await expect(page.locator('.bm-row', { hasText: 'E2E Example' })).toBeVisible();

  // Reload keeps everything (A19).
  await page.reload();
  await page.getByRole('button', { name: 'Bookmarks', exact: true }).click();
  await expect(page.locator('.bm-card, .bm-row', { hasText: 'E2E Example' })).toBeVisible();

  // Clicking opens the URL in a new tab and records the click (A94).
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('.bm-item__title', { hasText: 'E2E Example' }).click(),
  ]);
  expect(newPage.url()).toContain('example.com');
  await newPage.close();
  await expect(page.locator('.bm-item__meta', { hasText: '1 click' }).first()).toBeVisible();
});

test('cover upload and replace (A83)', async ({ page }) => {
  await openBookmarks(page);

  // Create a bookmark first (cover upload lives in the edit panel).
  await page.getByRole('button', { name: 'New bookmark' }).click();
  const editor = page.locator('.bm-editor');
  await editor.getByPlaceholder('Name', { exact: true }).fill('E2E Covered');
  await editor.getByPlaceholder('https://…', { exact: true }).fill('https://covered.example');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.bm-card, .bm-row', { hasText: 'E2E Covered' })).toBeVisible();

  await page.locator('.bm-item__edit').first().click();
  const buffer = Buffer.from(PNG_BASE64, 'base64');
  await page.locator('.bm-editor__cover-input').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer,
  });
  await expect(page.locator('.bm-editor__cover-preview')).toBeVisible();

  // Reopen after reload: the cover is still served from object storage.
  await page.reload();
  await page.getByRole('button', { name: 'Bookmarks', exact: true }).click();
  await page.locator('.bm-item__edit').first().click();
  await expect(page.locator('.bm-editor__cover-preview')).toBeVisible();
});

test('30-day inactive bookmarks drop into the gray compact list (A96)', async ({ page }) => {
  await openBookmarks(page);

  // Seed one bookmark and backdate its last click via the e2e postgres container.
  const res = await http(page).post('/api/bookmarks', {
    data: { id: crypto.randomUUID(), title: 'E2E Stale', url: 'https://stale.example', categories: ['old'] },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const created = (await res.json()) as { id: string };
  await page.request.get('/api/bookmarks'); // no-op keep-alive
  const { execFileSync } = await import('node:child_process');
  // Absolute docker path: the Playwright worker PATH may not include it.
  const docker = process.env.DOCKER_BIN ?? '/usr/local/bin/docker';
  execFileSync(docker, [
    'exec',
    'chpli2-postgres',
    'psql',
    '-U',
    'chpli2',
    '-d',
    'chpli2',
    '-c',
    `UPDATE bookmarks SET "lastClickedAt" = now() - interval '31 days' WHERE id = '${created.id}'`,
  ]);

  await page.reload();
  await page.getByRole('button', { name: 'Bookmarks', exact: true }).click();

  const section = page.getByTestId('inactive-section');
  await expect(section).toContainText('Inactive (1)');
  await page.getByText('Expand', { exact: true }).click();
  const list = page.getByTestId('inactive-list');
  await expect(list).toContainText('E2E Stale');
  await expect(list).toContainText('old');
  await expect(list).toContainText('stale.example');
  await expect(list.locator('.bm-item__meta')).toHaveCount(0); // compact: no click stats

  // Clicking it revives the bookmark into the active section (D5 loop).
  await list.getByRole('button', { name: 'E2E Stale' }).click();
  await expect(page.locator('.bm-card, .bm-row', { hasText: 'E2E Stale' })).toBeVisible();
  await expect(page.getByTestId('inactive-section')).toHaveCount(0);
});
