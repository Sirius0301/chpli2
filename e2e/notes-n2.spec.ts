import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the Notes N2 slice: full-text search (A76), wiki
 * links + backlinks (A77/A78), version history with restore-as-new-revision
 * (A79) and image attachments (A80).
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function seed(page: Page): Promise<{ alphaId: string; betaId: string }> {
  const alphaId = crypto.randomUUID();
  const betaId = crypto.randomUUID();
  const notes = [
    { id: alphaId, title: 'Alpha hub', body: '# Alpha\n\ncore content', tags: ['core'] },
    { id: betaId, title: 'Beta pointer', body: `References [[${alphaId}]]`, tags: ['link'] },
    { id: crypto.randomUUID(), title: 'Grocery list', body: 'milk eggs', tags: ['personal'] },
  ];
  for (const n of notes) {
    const res = await http(page).post('/api/notes', { data: n });
    expect(res.ok(), `${n.title}: ${await res.text()}`).toBeTruthy();
  }
  return { alphaId, betaId };
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-n2-${Date.now()}-${testInfo.workerIndex}`);
});

async function openNotes(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
}

test('full-text search across title, body and tags (A76)', async ({ page }) => {
  await seed(page);
  await openNotes(page);

  // Title hit.
  await page.getByLabel('Search title, body, tags…').fill('grocery');
  await expect(page.locator('.notes-home__card', { hasText: 'Grocery list' })).toBeVisible();
  await expect(page.locator('.notes-home__card', { hasText: 'Alpha hub' })).toHaveCount(0);

  // Body hit (case-insensitive).
  await page.getByLabel('Search title, body, tags…').fill('CORE');
  await expect(page.locator('.notes-home__card', { hasText: 'Alpha hub' })).toBeVisible();
  await expect(page.locator('.notes-home__card', { hasText: 'Grocery list' })).toHaveCount(0);

  // Tag hit.
  await page.getByLabel('Search title, body, tags…').fill('personal');
  await expect(page.locator('.notes-home__card', { hasText: 'Grocery list' })).toBeVisible();
  await expect(page.locator('.notes-home__card', { hasText: 'Alpha hub' })).toHaveCount(0);
});

test('wiki link navigation and backlinks panel (A77/A78)', async ({ page }) => {
  await seed(page);
  await openNotes(page);

  // Preview renders [[id]] as the target's title; clicking opens it.
  await page.locator('.notes-home__card', { hasText: 'Beta pointer' }).click();
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  const link = page.getByTestId('preview').getByRole('button', { name: 'Alpha hub' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByPlaceholder('Enter a title', { exact: true })).toHaveValue('Alpha hub');

  // The target shows the backlink; clicking it returns to the referrer.
  await page.getByRole('button', { name: /Backlinks/ }).click();
  const panel = page.getByTestId('backlinks-panel');
  await expect(panel).toContainText('Beta pointer');
  await panel.getByRole('button', { name: 'Beta pointer' }).click();
  await expect(page.getByPlaceholder('Enter a title', { exact: true })).toHaveValue('Beta pointer');
});

test('version history: edits create versions; restore rolls back as a new revision (A79)', async ({ page }) => {
  await seed(page);
  await openNotes(page);

  await page.locator('.notes-home__card', { hasText: 'Alpha hub' }).click();
  const bodyOnServer = () =>
    page.request
      .get('/api/notes', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (res) => {
        const notes = (await res.json()) as { title: string; body: string }[];
        return notes.find((n) => n.title === 'Alpha hub')?.body;
      });
  // Wait for each autosave round-trip: the "Saved" label alone may predate
  // the actual PATCH, and the debounce coalesces rapid edits into one save.
  await page.getByPlaceholder('Write in Markdown…').fill('second version content');
  await expect.poll(bodyOnServer, { timeout: 10_000 }).toBe('second version content');
  await page.getByPlaceholder('Write in Markdown…').fill('third version content');
  await expect.poll(bodyOnServer, { timeout: 10_000 }).toBe('third version content');

  // History lists versions; restoring v1 rolls back the body.
  await page.getByRole('button', { name: 'Versions' }).click();
  const panel = page.getByTestId('versions-panel');
  await expect(panel).toContainText('v3');
  await expect(panel).toContainText('v1');

  await panel.locator('.note-editor__version', { hasText: 'v1' }).getByRole('button', { name: 'Restore' }).click();
  await panel.locator('.note-editor__version', { hasText: 'v1' }).getByRole('button', { name: 'Confirm restore?' }).click();

  await expect(page.getByPlaceholder('Write in Markdown…')).toHaveValue('# Alpha\n\ncore content');
  // The restore itself became a new version (v5): pre-restore snapshot + restore.
  await expect(page.getByTestId('versions-panel')).toContainText('v5');
});

test('image attachments upload, persist and delete (A80)', async ({ page }) => {
  await seed(page);
  await openNotes(page);
  await page.locator('.notes-home__card', { hasText: 'Alpha hub' }).click();
  await page.getByRole('button', { name: 'Images' }).click();
  await expect(page.locator('.note-editor__drawer')).toBeVisible();

  const buffer = Buffer.from(PNG_BASE64, 'base64');
  await page.locator('.note-images__input').setInputFiles({
    name: 'note-img.png',
    mimeType: 'image/png',
    buffer,
  });
  await expect(page.locator('.note-images__item')).toHaveCount(1);

  // Reload: the attachment survives (the drawer starts closed after reload).
  await page.reload();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.locator('.notes-home__card', { hasText: 'Alpha hub' }).click();
  await page.getByRole('button', { name: 'Images' }).click();
  await expect(page.locator('.note-images__item')).toHaveCount(1);

  // Two-step delete.
  await page.locator('.note-images__remove').click();
  await page.locator('.note-images__remove--confirm').click();
  await expect(page.locator('.note-images__item')).toHaveCount(0);
});
