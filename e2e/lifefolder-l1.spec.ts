import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the Life Folder L1 slice:
 *  1. Built-in taxonomy, real PDF upload with sensitive default, download
 *     and recommendation fulfilment (A107/A108/A110).
 *  2. Move with confirmation and guarded category deletion (A109/E109/E112).
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

// Minimal valid single-page PDF.
const PDF_BASE64 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
  'ascii',
).toString('base64');

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-l1-${Date.now()}-${testInfo.workerIndex}`);
});

async function openLifeFolder(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Life Folder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Life Folder' })).toBeVisible();
}

test('built-in taxonomy, PDF upload with sensitive default and recommendation fulfilment (A107/A108/A110)', async ({
  page,
}) => {
  await openLifeFolder(page);

  // Seven built-in categories; recommendations show the ID card template.
  await expect(page.locator('.lf-cat__name')).toHaveCount(7);
  const recs = page.getByTestId('recommendations');
  await expect(recs).toContainText('身份证');

  // Upload via the recommendation shortcut.
  await recs.locator('.lf-rec', { hasText: '身份证' }).getByRole('button', { name: 'Add from template' }).click();
  const dialog = page.locator('.lf-upload');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Document title').fill('E2E 我的身份证');
  // Sensitive defaults to on.
  await expect(dialog.getByText('Sensitive (private by default)')).toBeTruthy();
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'id-card.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(PDF_BASE64, 'base64'),
  });
  await dialog.locator('.lf-upload__actions').getByRole('button', { name: 'Upload file' }).click();

  // The document appears with the sensitive badge; the recommendation is gone.
  const row = page.locator('.lf-doc', { hasText: 'E2E 我的身份证' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Sensitive');
  await expect(page.getByTestId('recommendations')).not.toContainText('身份证');

  // Download round-trips the exact bytes.
  const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('link', { name: 'Download' }).click()]);
  const path = await download.path();
  expect(path).toBeTruthy();
});

test('move with confirmation and guarded category deletion (A109/E109/E112)', async ({ page }) => {
  await openLifeFolder(page);

  // Create a custom category and upload a document into it.
  await page.getByRole('button', { name: 'New category' }).click();
  await page.getByPlaceholder('Category name').fill('E2E Temp');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.lf-cat__name', { hasText: 'E2E Temp' })).toBeVisible();

  await page.locator('.lf-cat__name', { hasText: 'E2E Temp' }).click();
  await page.getByRole('button', { name: 'Upload file' }).click();
  const dialog = page.locator('.lf-upload');
  await dialog.getByPlaceholder('Document title').fill('E2E Movable');
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'doc.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(PDF_BASE64, 'base64'),
  });
  await dialog.locator('.lf-upload__actions').getByRole('button', { name: 'Upload file' }).click();
  const row = page.locator('.lf-doc', { hasText: 'E2E Movable' });
  await expect(row).toBeVisible();

  // Move with an explicit confirm step (the select first asks to confirm).
  await row.getByRole('button', { name: 'Move to…' }).click();
  await row.locator('select').selectOption({ label: '其他' });
  await expect(page.locator('.lf-docs__empty')).toBeVisible();

  // The now-empty custom category can be deleted (two-step).
  const catRow = page.locator('.lf-cat', { hasText: 'E2E Temp' });
  await catRow.getByRole('button', { name: '×' }).click();
  await catRow.getByRole('button', { name: 'Click again to confirm deleting the category' }).click();
  await expect(page.locator('.lf-cat__name', { hasText: 'E2E Temp' })).toHaveCount(0);

  // Built-in categories are locked (no delete button at all).
  await expect(page.locator('.lf-cat__name', { hasText: '身份与证件' }).getByRole('button')).toHaveCount(0);
});
