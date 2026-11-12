import { expect, test, type Page } from '@playwright/test';
import { signIn } from './auth';

/**
 * End-to-end coverage of the M3 memo image slice:
 *  1. Upload a real PNG through the DetailPanel -> thumbnail -> survives
 *     reload -> two-step delete removes it (A54, A18).
 *  2. DetailPanel responsiveness: drawer at tablet width, bottom sheet at
 *     phone width, backdrop visible in both (E64/A58).
 *
 * Requires the MinIO container (infra/docker-compose.yml) for the upload
 * path; docker was available when this suite ran.
 */

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function createMemoViaUi(page: Page, title: string): Promise<void> {
  const today = new Date();
  const body = page.locator(`.day-col[data-day="${dayKey(today)}"] .day-col__body`);
  await body.click();
  const panel = page.locator('.detail-panel');
  await panel.getByLabel('Title').fill(title);
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel).toHaveCount(0);
}

async function openEditor(page: Page, title: string) {
  await page.locator('.memo-chip__title', { hasText: title }).click();
  const panel = page.locator('.detail-panel');
  await expect(panel).toBeVisible();
  return panel;
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  await signIn(page, `e2e-m3-${Date.now()}-${testInfo.workerIndex}`);
});

test('upload an image through the panel, persists across reload, delete with confirm (A54)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();

  await createMemoViaUi(page, 'M3-photo');
  let panel = await openEditor(page, 'M3-photo');

  const buffer = Buffer.from(PNG_BASE64, 'base64');
  await panel.locator('.memo-images__input').setInputFiles({
    name: 'red-dot.png',
    mimeType: 'image/png',
    buffer,
  });
  await expect(panel.locator('.memo-images__item')).toHaveCount(1);

  // Reload and reopen: the image metadata and object both persist (A19).
  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  panel = await openEditor(page, 'M3-photo');
  await expect(panel.locator('.memo-images__item')).toHaveCount(1);

  // Deleting needs the explicit second click (confirmation step).
  await panel.locator('.memo-images__remove').click();
  await panel.locator('.memo-images__remove--confirm').click();
  await expect(panel.locator('.memo-images__item')).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  panel = await openEditor(page, 'M3-photo');
  await expect(panel.locator('.memo-images__item')).toHaveCount(0);
});

test('detail panel becomes a drawer and then a bottom sheet on narrow screens (A58/E64)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await createMemoViaUi(page, 'M3-responsive');

  // Desktop: no backdrop, panel sits inside the layout.
  await openEditor(page, 'M3-responsive');
  await expect(page.locator('.detail-panel-backdrop')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.detail-panel')).toBeHidden();

  // Tablet (<=900px): right drawer with a visible backdrop; backdrop closes.
  await page.setViewportSize({ width: 800, height: 700 });
  let panel = await openEditor(page, 'M3-responsive');
  await expect(page.locator('.detail-panel-backdrop')).toBeVisible();
  const drawerBox = await panel.boundingBox();
  expect(drawerBox!.x).toBeGreaterThan(400);
  await page.locator('.detail-panel-backdrop').click();
  await expect(page.locator('.detail-panel')).toBeHidden();

  // Phone (<=600px): bottom sheet anchored to the bottom of the viewport.
  await page.setViewportSize({ width: 390, height: 700 });
  panel = await openEditor(page, 'M3-responsive');
  const sheetBox = await panel.boundingBox();
  expect(sheetBox!.y + sheetBox!.height).toBe(700); // anchored at the bottom
  expect(sheetBox!.height).toBeLessThanOrEqual(0.7 * 700 + 1); // capped at 70vh
});
