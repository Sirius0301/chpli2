import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the M2 memo slice:
 *  1. Tags: create via API, filter sidebar candidates with counts, two-level
 *     filtering (tags AND / priorities OR), clear filters (A48-A51).
 *  2. Lunar month view: zh-CN shows lunar day + solar terms; English hides
 *     the lunar layer (A52/E57). Out-of-range silence is unit-covered (E56).
 *
 * Runs in English except the lunar test, which switches the UI to 中文.
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

const pad = (value: number) => String(value).padStart(2, '0');

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function seedMemos(page: Page, today: Date): Promise<void> {
  const key = dayKey(today);
  const memos = [
    { title: 'M2-work-home', tags: ['work', 'home'], priority: 'high' },
    { title: 'M2-work-only', tags: ['work'], priority: 'low' },
    { title: 'M2-home-only', tags: ['home'], priority: 'medium' },
  ];
  for (const m of memos) {
    const res = await http(page).post('/api/memos', {
      data: { id: crypto.randomUUID(), title: m.title, date: key, tags: m.tags, priority: m.priority },
    });
    expect(res.ok(), `${m.title}: ${await res.text()}`).toBeTruthy();
  }
}

const chip = (page: Page, title: string) => page.locator('.memo-chip', { hasText: title });

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-m2-${Date.now()}-${testInfo.workerIndex}`);
  await seedMemos(page, new Date());
});

async function openCalendar(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
}

test('tag candidates with counts and two-level filtering (A48-A51)', async ({ page }) => {
  await openCalendar(page);

  // Sidebar candidates carry counts and ignore the active filters (D5).
  await expect(page.locator('.memo-sidebar')).toContainText('work');
  await expect(page.locator('.memo-sidebar')).toContainText('home');

  // Tag filter: single tag, then AND with a second tag.
  await page.getByRole('checkbox', { name: /^work/ }).check();
  await expect(chip(page, 'M2-work-home')).toHaveCount(1);
  await expect(chip(page, 'M2-work-only')).toHaveCount(1);
  await expect(chip(page, 'M2-home-only')).toHaveCount(0);

  await page.getByRole('checkbox', { name: /^home/ }).check();
  await expect(chip(page, 'M2-work-home')).toHaveCount(1);
  await expect(chip(page, 'M2-work-only')).toHaveCount(0);
  await expect(chip(page, 'M2-home-only')).toHaveCount(0);

  // Two levels AND together: tag AND + priority OR.
  await page.getByRole('checkbox', { name: 'Low' }).check();
  await expect(chip(page, 'M2-work-home')).toHaveCount(0); // high, not low
  await page.getByRole('checkbox', { name: 'Low' }).uncheck();
  await page.getByRole('checkbox', { name: 'High' }).check();
  await expect(chip(page, 'M2-work-home')).toHaveCount(1);
  await expect(chip(page, 'M2-work-only')).toHaveCount(0); // low, not high

  // Clear filters restores everything (A51).
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(chip(page, 'M2-work-home')).toHaveCount(1);
  await expect(chip(page, 'M2-work-only')).toHaveCount(1);
  await expect(chip(page, 'M2-home-only')).toHaveCount(1);
});

test('priority filter uses OR across levels (A50)', async ({ page }) => {
  await openCalendar(page);
  await page.getByRole('checkbox', { name: 'High' }).check();
  await page.getByRole('checkbox', { name: 'Medium' }).check();
  await expect(chip(page, 'M2-work-home')).toHaveCount(1); // high
  await expect(chip(page, 'M2-home-only')).toHaveCount(1); // medium
  await expect(chip(page, 'M2-work-only')).toHaveCount(0); // low
});

test('lunar layer in zh-CN month view, hidden in English (A52/E57)', async ({ page }) => {
  await openCalendar(page);
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(page.locator('.month-view__cell')).toHaveCount(42);
  // English locale: no lunar layer.
  await expect(page.locator('.month-view__lunar')).toHaveCount(0);

  // Switch the whole shell to 中文; the remote follows.
  await page.getByLabel('Language').selectOption('zh-CN');
  await expect(page.getByRole('tab', { name: '月', exact: true })).toBeVisible();
  await expect(page.locator('.month-view__lunar').first()).toBeVisible();
  // Every Gregorian month contains at least one 节气 in the 6x7 grid.
  await expect(page.locator('.month-view__jieqi').first()).toBeVisible();

  // Back to English: the lunar layer disappears (E57).
  await page.getByLabel('语言').selectOption('en');
  await expect(page.locator('.month-view__lunar')).toHaveCount(0);
});

test('tags can be added and edited through the detail panel (A48)', async ({ page }) => {
  await openCalendar(page);
  const today = new Date();
  const body = page.locator(`.day-col[data-day="${dayKey(today)}"] .day-col__body`);
  await body.click();
  const panel = page.locator('.detail-panel');
  await panel.getByLabel('Title').fill('M2-tagged-ui');
  await panel.getByPlaceholder('Press Enter to add').fill('ui-tag');
  await panel.getByPlaceholder('Press Enter to add').press('Enter');
  await expect(panel.locator('.tag-editor').getByText('ui-tag')).toBeVisible();
  await panel.getByRole('button', { name: 'Save' }).click();

  await expect(chip(page, 'M2-tagged-ui')).toHaveCount(1);
  // The new tag becomes a sidebar candidate (via the aggregate endpoint).
  await expect(page.locator('.memo-sidebar')).toContainText('ui-tag');
});
