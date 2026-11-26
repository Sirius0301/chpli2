import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the Growth G1 slice:
 *  1. Goal -> milestones -> derived progress -> manual status (A97/A98).
 *  2. Cross-module link to a note: validated, titled, idempotent; the "Open"
 *     button switches the Host to Notes and selects the note (A99/A100/D6).
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-g1-${Date.now()}-${testInfo.workerIndex}`);
});

async function openGrowth(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Growth & Career' })).toBeVisible();
}

test('goal, milestones and derived progress (A97/A98)', async ({ page }) => {
  await openGrowth(page);

  // Create a goal.
  await page.getByRole('button', { name: 'New goal' }).click();
  const editor = page.locator('.goal-editor');
  await editor.getByPlaceholder('Goal title').fill('E2E Staff Engineer');
  await editor.getByLabel('Target date').fill('2027-06-30');
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.goal-detail')).toBeVisible();

  // Add two milestones; progress stays 0.
  const addRow = page.locator('.goal-milestone__add');
  await addRow.getByPlaceholder('Milestone title').fill('Finish RFC');
  await addRow.getByRole('button', { name: 'Add milestone' }).click();
  await expect(page.getByRole('checkbox', { name: 'Finish RFC' })).toBeVisible();
  await addRow.getByPlaceholder('Milestone title').fill('Mentor two engineers');
  await addRow.getByRole('button', { name: 'Add milestone' }).click();
  await expect(page.getByRole('checkbox', { name: 'Mentor two engineers' })).toBeVisible();
  await expect(page.getByTestId('progress-bar')).toHaveCSS('width', '0px');

  // Toggle the first milestone -> 50% (derived, visible in both views).
  await page.getByRole('checkbox', { name: 'Finish RFC' }).check();
  await expect(page.getByTestId('progress-bar')).not.toHaveCSS('width', '0px');
  await expect(page.locator('.goal-detail')).toContainText('Progress 50%');

  // All done does not auto-achieve (D3); status flips manually.
  await page.getByRole('checkbox', { name: 'Mentor two engineers' }).check();
  await expect(page.locator('.goal-detail')).toContainText('Progress 100%');
  await page.locator('.goal-detail__status select').selectOption('achieved');
  await expect(page.locator('.goal-detail')).toContainText('Achieved');

  // Reload: everything persists (A19).
  await page.reload();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await expect(page.locator('.goal-detail')).toContainText('Progress 100%');
  await expect(page.getByRole('checkbox', { name: 'Finish RFC' })).toBeChecked();
});

test('linking a note and opening it across modules (A99/A100)', async ({ page }) => {
  await openGrowth(page);

  // Seed a note and a goal via API.
  const note = await http(page).post('/api/notes', {
    data: { id: crypto.randomUUID(), title: 'E2E Career plan' },
  });
  const goal = await http(page).post('/api/goals', {
    data: { id: crypto.randomUUID(), title: 'E2E Linked goal' },
  });
  expect(note.ok() && goal.ok()).toBeTruthy();
  const noteId = (await note.json()).id as string;

  // The list was fetched before the seeding: reload to see the new goal.
  await page.reload();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();

  // Link the note through the UI picker.
  await page.getByRole('button', { name: /E2E Linked goal/ }).click();
  await page.getByLabel('Link a note…').selectOption({ label: 'E2E Career plan' });
  const linkRow = page.locator('.goal-link');
  await expect(linkRow).toContainText('E2E Career plan');
  await expect(linkRow).toContainText('Note');

  // Re-adding is idempotent (E100).
  await http(page).put(`/api/goals/${(await goal.json()).id}/links`, {
    data: { module: 'notes', refId: noteId },
  });
  await expect(page.locator('.goal-link')).toHaveCount(1);

  // Open the link: Host switches to Notes and the note gets selected (D6).
  await linkRow.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Enter a title', { exact: true })).toHaveValue('E2E Career plan');
});
