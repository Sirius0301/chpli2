import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the Notes N1 slice:
 *  1. Create a note via the UI -> Markdown preview -> tags -> priority ->
 *     autosave -> persistence after reload (A70/A71).
 *  2. Raw HTML in the body is escaped in preview (E82).
 *  3. Two-level filtering in the sidebar (A72) and cross-user isolation (E80).
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

async function seedNotes(page: Page): Promise<void> {
  const notes = [
    { title: 'N1-work-home', body: '# Work\n\n- a\n- b', tags: ['work', 'home'], priority: 'high' },
    { title: 'N1-home-only', body: '<img src=x onerror="globalThis.__xss=1">', tags: ['home'], priority: 'low' },
  ];
  for (const n of notes) {
    const res = await http(page).post('/api/notes', { data: { id: crypto.randomUUID(), ...n } });
    expect(res.ok(), `${n.title}: ${await res.text()}`).toBeTruthy();
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-n1-${Date.now()}-${testInfo.workerIndex}`);
  await seedNotes(page);
});

async function openNotes(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
}

test('create, preview, autosave and persist a Markdown note (A70/A71)', async ({ page }) => {
  await openNotes(page);

  // Create a new note and type Markdown into it.
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByPlaceholder('Enter a title', { exact: true }).fill('E2E markdown note');
  await page
    .getByPlaceholder('Write in Markdown…')
    .fill('# Big heading\n\nSome **bold** text');

  // Autosave fires after the debounce: the API reflects the new body.
  await expect
    .poll(
      async () => {
        const res = await page.request.get('/api/notes', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const notes = (await res.json()) as { title: string; body: string }[];
        return notes.find((n) => n.title === 'E2E markdown note')?.body ?? '';
      },
      { timeout: 10_000 },
    )
    .toContain('Big heading');
  await expect(page.getByTestId('save-state')).toContainText('Backed up');

  // Preview renders the Markdown.
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  const preview = page.getByTestId('preview');
  await expect(preview.locator('h1')).toHaveText('Big heading');
  await expect(preview.locator('strong')).toHaveText('bold');

  // Reload: the note persists in the list and keeps its content.
  await page.reload();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.locator('.notes-home__card', { hasText: 'E2E markdown note' })).toBeVisible();
  await page.locator('.notes-home__card', { hasText: 'E2E markdown note' }).click();
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(page.getByTestId('preview').locator('h1')).toHaveText('Big heading');
});

test('raw HTML in the body is escaped in preview (E82)', async ({ page }) => {
  await openNotes(page);
  await page.locator('.notes-home__card', { hasText: 'N1-home-only' }).click();
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  const preview = page.getByTestId('preview');
  expect(await preview.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => (globalThis as { __xss?: boolean }).__xss)).toBeUndefined();
});

test('two-level filtering and tags with counts (A72)', async ({ page }) => {
  await openNotes(page);
  await expect(page.locator('.notes-filters')).toContainText('work');
  await expect(page.locator('.notes-filters')).toContainText('home');

  await page.getByRole('checkbox', { name: /^work/ }).check();
  await expect(page.locator('.notes-home__card', { hasText: 'N1-work-home' })).toBeVisible();
  await expect(page.locator('.notes-home__card', { hasText: 'N1-home-only' })).toHaveCount(0);

  // AND both tags: only the note carrying both remains.
  await page.getByRole('checkbox', { name: /^home/ }).check();
  await expect(page.locator('.notes-home__card', { hasText: 'N1-work-home' })).toBeVisible();
  await expect(page.locator('.notes-home__card', { hasText: 'N1-home-only' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.notes-home__card', { hasText: 'N1-home-only' })).toBeVisible();
});

test('another user cannot see my notes (E80)', async ({ page, browser }) => {
  await openNotes(page);
  await expect(page.locator('.notes-home__card', { hasText: 'N1-work-home' })).toBeVisible();

  // A second user in a fresh context sees an empty notes module.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  await signIn(pageB, `e2e-n1-b-${Date.now()}`);
  await pageB.goto('/');
  await pageB.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(pageB.locator('.notes-home__card', { hasText: 'N1-work-home' })).toHaveCount(0);
  await expect(pageB.getByText('No notes yet').first()).toBeVisible();
  await ctxB.close();
});
