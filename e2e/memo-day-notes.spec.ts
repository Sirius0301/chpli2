import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * Memo/Notes integration added 2026-11-27:
 *  - day view notes rail (notes created that local day; click opens edit view)
 *  - overflow tooltips for truncated memo/notes titles and tags
 *  - persisted resize handles for the memo/notes rails and panels
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-day-${Date.now()}-${testInfo.workerIndex}`);
});

async function openCalendar(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
}

test('narrow toolbar keeps the period title compact and the view tabs visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCalendar(page);
  const title = page.getByTestId('calendar-toolbar-title');
  await expect(title).toBeVisible();
  const box = await title.boundingBox();
  expect(box!.height).toBeLessThan(30);
  await expect(page.getByRole('tab', { name: 'Week', exact: true })).toBeVisible();
});

test('day view lists notes created that day and opens the Notes edit view', async ({ page }) => {
  const title = `Day-note-${Date.now()}`;
  const created = await http(page).post('/api/notes', {
    data: { id: crypto.randomUUID(), title, body: 'day view body', category: 'e2e' },
  });
  expect(created.ok(), await created.text()).toBeTruthy();

  await openCalendar(page);
  await page.getByRole('tab', { name: 'Day', exact: true }).click();
  const rail = page.getByTestId('day-notes');
  await expect(rail.getByRole('heading', { name: 'Notes created this day' })).toBeVisible();
  await expect(rail.getByText(title)).toBeVisible();

  await rail.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(title);
});

test('truncated memo and note titles expose a tooltip with the full text', async ({ page }) => {
  const longMemo = 'A deliberately long memo title that must be truncated in the sidebar due list';
  const longTag = 'long-tag-for-sidebar-overflow';
  const longNote = 'A deliberately long note title that must be truncated inside the notes card grid';
  const memo = await http(page).post('/api/memos', {
    data: {
      id: crypto.randomUUID(),
      title: longMemo,
      date: dayKey(new Date()),
      priority: 'high',
      tags: [longTag],
    },
  });
  expect(memo.ok(), await memo.text()).toBeTruthy();
  const note = await http(page).post('/api/notes', {
    data: { id: crypto.randomUUID(), title: longNote, body: 'note body' },
  });
  expect(note.ok(), await note.text()).toBeTruthy();

  await openCalendar(page);
  const dueTitle = page.getByTestId('due-card').getByText(longMemo);
  await expect(dueTitle).toBeVisible();
  await dueTitle.hover();
  await expect(page.getByRole('tooltip')).toContainText(longMemo);

  const tagLabel = page.locator(`[data-tag="${longTag}"]`).getByText(longTag);
  await tagLabel.hover();
  await expect(page.getByRole('tooltip')).toContainText(longTag);

  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const noteTitle = page.getByText(longNote).first();
  await expect(noteTitle).toBeVisible();
  await noteTitle.hover();
  await expect(page.getByRole('tooltip')).toContainText(longNote);
});

test('memo and notes rails/panels can be resized and remember the width', async ({ page }) => {
  await openCalendar(page);
  const sideBefore = await page.getByTestId('memo-sidebar').boundingBox();
  await resize(page, 'Resize memo sidebar', 70);
  const sideAfter = await page.getByTestId('memo-sidebar').boundingBox();
  expect(sideAfter!.width).toBeGreaterThan(sideBefore!.width + 40);

  // Reload: the width was persisted through the debounced storage hook.
  await page.waitForTimeout(350);
  await page.reload();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByTestId('memo-sidebar')).toBeVisible();
  const persisted = await page.getByTestId('memo-sidebar').boundingBox();
  expect(persisted!.width).toBeGreaterThan(sideBefore!.width + 40);

  // Right panel.
  await page.getByTestId('today-column-body').click();
  const panel = page.getByTestId('side-panel-panel');
  await expect(panel).toBeVisible();
  const panelBefore = await panel.boundingBox();
  await resize(page, 'Resize memo details panel', -60);
  const panelAfter = await panel.boundingBox();
  expect(panelAfter!.width).toBeGreaterThan(panelBefore!.width + 30);
  await page.keyboard.press('Escape');

  // Notes sidebar + drawer.
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note', exact: false }).click();
  await expect(page.getByTestId('notes-sidebar')).toBeVisible();
  const notesSideBefore = await page.getByTestId('notes-sidebar').boundingBox();
  await resize(page, 'Resize notes sidebar', 60);
  const notesSideAfter = await page.getByTestId('notes-sidebar').boundingBox();
  expect(notesSideAfter!.width).toBeGreaterThan(notesSideBefore!.width + 30);

  await page.getByRole('button', { name: 'Images' }).click();
  const drawer = page.getByTestId('side-panel-panel');
  await expect(drawer).toBeVisible();
  const drawerBefore = await drawer.boundingBox();
  await resize(page, 'Resize notes drawer', -50);
  const drawerAfter = await drawer.boundingBox();
  expect(drawerAfter!.width).toBeGreaterThan(drawerBefore!.width + 20);
});

async function resize(page: Page, label: string, deltaX: number): Promise<void> {
  const handle = page.getByRole('separator', { name: label });
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error(`no bounding box for ${label}`);
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(40, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 5 });
  await page.mouse.up();
}
