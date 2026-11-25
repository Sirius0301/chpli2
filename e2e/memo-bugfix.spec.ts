import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the 2026-11 bugfix round:
 *  1. Home: logo + welcome on one line, core values and module cards.
 *  2. Month view: clicking a day cell opens the create panel; empty cells
 *     carry the gray click-to-create hint.
 *  3. Unsaved-edit guard: switching memos with edits asks to save first;
 *     "Save & open" persists, toasts and opens the other memo.
 *  4. Sidebar: tag rename/delete across memos, tag and due-soon totals.
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

const pad = (value: number) => String(value).padStart(2, '0');

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function openCalendar(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
}

async function seedMemo(page: Page, title: string, extra: Record<string, unknown> = {}): Promise<void> {
  const res = await http(page).post('/api/memos', {
    data: { id: crypto.randomUUID(), title, date: dayKey(new Date()), ...extra },
  });
  expect(res.ok(), `${title}: ${await res.text()}`).toBeTruthy();
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-bugfix-${Date.now()}-${testInfo.workerIndex}`);
});

test('home shows the hero on one line, core values and module cards', async ({ page }) => {
  await page.goto('/');
  const title = page.locator('.home__hero-title');
  await expect(title.getByRole('heading', { name: 'Welcome to CHPLI' })).toBeVisible();
  await expect(title.locator('.home__logo')).toBeVisible();
  // Logo and heading share one row.
  const logoBox = await title.locator('.home__logo').boundingBox();
  const headingBox = await title.getByRole('heading').boundingBox();
  expect(Math.abs(logoBox!.y - headingBox!.y)).toBeLessThan(logoBox!.height);

  await expect(page.locator('.home__value-card')).toHaveCount(5);
  await expect(page.locator('.home__module-card')).toHaveCount(6);

  // Module cards navigate into the remote.
  await page.locator('.home__module-card', { hasText: 'Calendar' }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
});

test('month cell click creates; empty cells show the gray hint', async ({ page }) => {
  await openCalendar(page);
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(page.locator('.month-view__cell')).toHaveCount(42);
  await expect(page.locator('.month-view__hint').first()).toBeVisible();

  const todayKey = dayKey(new Date());
  await page.locator(`.month-view__cell[data-day="${todayKey}"]`).click();
  const panel = page.locator('.detail-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Title').fill('BF month cell memo');
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.memo-chip', { hasText: 'BF month cell memo' })).toHaveCount(1);
});

test('unsaved edit guard asks before switching memos (save & open + toast)', async ({ page }) => {
  await seedMemo(page, 'BF first');
  await seedMemo(page, 'BF second');
  await openCalendar(page);

  await page.locator('.memo-chip__title', { hasText: 'BF first' }).click();
  const panel = page.locator('.detail-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Title').fill('BF first edited');

  // Switching with unsaved edits asks first.
  await page.locator('.memo-chip__title', { hasText: 'BF second' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();

  // Cancel keeps the dirty panel untouched.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByLabel('Title')).toHaveValue('BF first edited');

  // Save & open persists, toasts and opens the other memo.
  await page.locator('.memo-chip__title', { hasText: 'BF second' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Save & open' }).click();
  await expect(page.locator('.cal-toast')).toContainText('Memo saved');
  await expect(panel.getByLabel('Title')).toHaveValue('BF second');

  // Without edits, switching is direct (no dialog).
  await page.locator('.memo-chip__title', { hasText: 'BF first edited' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(panel.getByLabel('Title')).toHaveValue('BF first edited');
});

test('sidebar tag rename/delete and header totals', async ({ page }) => {
  await seedMemo(page, 'BF tagged one', { tags: ['alpha', 'beta'] });
  await seedMemo(page, 'BF tagged two', { tags: ['alpha'] });
  await openCalendar(page);

  const sidebar = page.locator('.memo-sidebar');
  await expect(sidebar.getByTestId('tag-total')).toHaveText('2');
  // Both memos are due today -> due total shows 2.
  await expect(sidebar.getByTestId('due-total')).toHaveText('2');

  // Rename alpha -> gamma across all memos.
  await sidebar.getByRole('button', { name: 'Rename tag alpha' }).click();
  await sidebar.getByRole('textbox', { name: 'Rename tag alpha' }).fill('gamma');
  await sidebar.getByRole('textbox', { name: 'Rename tag alpha' }).press('Enter');
  await expect(sidebar.locator('.memo-sidebar__row[data-tag="gamma"]')).toBeVisible();
  await expect(sidebar.locator('.memo-sidebar__row[data-tag="alpha"]')).toHaveCount(0);

  // Delete beta (two-click confirm).
  await sidebar.getByRole('button', { name: 'Delete tag beta' }).click();
  await sidebar.getByRole('button', { name: 'Delete tag beta' }).click();
  await expect(sidebar.locator('.memo-sidebar__row[data-tag="beta"]')).toHaveCount(0);
  await expect(sidebar.getByTestId('tag-total')).toHaveText('1');

  // The rename reached the memos themselves.
  const list = await http(page).get(
    `/api/memos?from=${dayKey(new Date())}&to=${dayKey(new Date(Date.now() + 86_400_000))}`,
  );
  const rows = (await list.json()) as { tags: string[] }[];
  const tags = rows.flatMap((m) => m.tags);
  expect(tags).toContain('gamma');
  expect(tags).not.toContain('alpha');
});

test('repeating memo deletion offers this-day vs all-occurrences choice', async ({ page }) => {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const res = await http(page).post('/api/memos', {
    data: {
      id: crypto.randomUUID(),
      title: 'BF repeating',
      date: dayKey(firstOfMonth),
      repeat: 'custom',
      repeatDays: [firstOfMonth.getDay()],
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();

  await openCalendar(page);
  await page.getByRole('tab', { name: 'Month', exact: true }).click();
  const chips = page.locator('.memo-chip', { hasText: 'BF repeating' });
  await expect.poll(() => chips.count()).toBeGreaterThanOrEqual(4);
  const total = await chips.count();

  // Delete only the first occurrence's day.
  const firstDate = await chips.first().getAttribute('data-date');
  await chips.first().locator('.memo-chip__title').click();
  const panel = page.locator('.detail-panel');
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  await panel.getByRole('button', { name: 'Delete this day only' }).click();
  await expect(panel).toHaveCount(0);
  await expect(chips).toHaveCount(total - 1);
  await expect(page.locator(`.memo-chip[data-date="${firstDate}"]`)).toHaveCount(0);

  // Delete the whole series from another occurrence.
  await chips.first().locator('.memo-chip__title').click();
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  await panel.getByRole('button', { name: 'Delete all occurrences' }).click();
  await expect(panel).toHaveCount(0);
  await expect(chips).toHaveCount(0);
});
