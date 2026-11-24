import { expect, test, type Page } from '@playwright/test';
import { signIn } from './auth';

/**
 * End-to-end coverage of the M1 memo slice:
 *  1. Create -> persistence after reload -> edit -> delete with confirm.
 *  2. Week view is the default; the view preference survives a reload.
 *  3. Custom weekday repeat expands across the month view; per-instance completion
 *     persists without affecting sibling instances.
 *  4. Validation: an empty title cannot be saved.
 *
 * All tests run in English (zh/de unit coverage lives in the component tests).
 */

function dayKey(date: Date): string {  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function openCalendar(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
}

/** Creates a memo through the UI on the given local date; returns nothing. */
async function createMemoViaUi(page: Page, day: Date, title: string, repeat = 'Does not repeat') {
  const body = page.locator(`.day-col[data-day="${dayKey(day)}"] .day-col__body`);
  await body.click();
  const panel = page.locator('.detail-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Title').fill(title);
  if (repeat !== 'Does not repeat') {
    await panel.getByLabel('Repeat').selectOption({ label: repeat });
  }
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel).toHaveCount(0);
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  await signIn(page, `e2e-memo-${Date.now()}-${testInfo.workerIndex}`);
});

test('create, persist across reload, edit and delete a memo (A41, A19)', async ({ page }) => {
  await openCalendar(page);
  const today = new Date();
  await createMemoViaUi(page, today, 'E2E buy milk');

  const chip = page.locator('.memo-chip', { hasText: 'E2E buy milk' });
  await expect(chip).toHaveCount(1);

  // Reload: the memo persists and renders again (the host resets to home;
  // the calendar module reopens with the persisted view preference).
  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.memo-chip', { hasText: 'E2E buy milk' })).toHaveCount(1);

  // Edit the title through the detail panel.
  await page.locator('.memo-chip__title', { hasText: 'E2E buy milk' }).click();
  const panel = page.locator('.detail-panel');
  await panel.getByLabel('Title').fill('E2E buy oat milk');
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.memo-chip', { hasText: 'E2E buy oat milk' })).toHaveCount(1);

  // Delete requires an explicit second click (confirmation step, A18).
  await page.locator('.memo-chip__title', { hasText: 'E2E buy oat milk' }).click();
  await panel.getByRole('button', { name: 'Delete' }).click();
  await panel.getByRole('button', { name: 'Click again to confirm deletion' }).click();
  await expect(page.locator('.memo-chip', { hasText: 'E2E buy oat milk' })).toHaveCount(0);
});

test('week view is default and the view preference survives reload (A42)', async ({ page }) => {
  await openCalendar(page);
  await expect(page.locator('.day-col')).toHaveCount(7);
  await expect(page.locator('.month-view__cell')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(page.locator('.month-view__cell')).toHaveCount(42);

  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.month-view__cell')).toHaveCount(42);
});

test('custom weekday repeat expands across the month; per-instance completion persists (A43, A45)', async ({
  page,
}) => {
  await openCalendar(page);
  // Create on the 1st of the current month: the custom rule defaults to the
  // memo date's weekday, which then occurs >= 4 times in the month grid.
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  await page.locator(`.month-view__cell[data-day="${dayKey(firstOfMonth)}"]`).click();
  const panel = page.locator('.detail-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Title').fill('E2E weekly sync');
  await panel.getByLabel('Repeat').selectOption({ label: 'Custom (by weekday)' });
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel).toHaveCount(0);

  // Month view: one chip per same-weekday occurrence (4 or 5 in a month).
  const monthCount = await page
    .locator('.memo-chip', { hasText: 'E2E weekly sync' })
    .count();
  expect(monthCount).toBeGreaterThanOrEqual(4);

  // Complete one instance: it shows struck-through and stays completed after reload.
  await page
    .locator('.memo-chip', { hasText: 'E2E weekly sync' })
    .first()
    .getByRole('checkbox')
    .click();
  await expect(
    page.locator('.memo-chip--done', { hasText: 'E2E weekly sync' }),
  ).toHaveCount(1);

  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(
    page.locator('.memo-chip--done', { hasText: 'E2E weekly sync' }),
  ).toHaveCount(1);
  // The other instances remain uncompleted.
  await expect(
    page.locator('.memo-chip:not(.memo-chip--done)', { hasText: 'E2E weekly sync' }),
  ).toHaveCount(monthCount - 1);
});

test('empty title is rejected with an inline error (E43)', async ({ page }) => {
  await openCalendar(page);
  const today = new Date();
  const body = page.locator(`.day-col[data-day="${dayKey(today)}"] .day-col__body`);
  await body.click();
  const panel = page.locator('.detail-panel');
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel.getByRole('alert')).toContainText('Title is required');
  await expect(panel).toBeVisible();
});
