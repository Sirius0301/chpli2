import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the Growth G2 slice:
 *  1. Skill with proficiency + owning goal; evidence/resource links (A102/A103).
 *  2. Review + memo link + schedule-next-memo idempotency + cross-module
 *     open into the calendar (A104/A105/D6/D7).
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

function pad(v: number) {
  return String(v).padStart(2, '0');
}

function offsetKey(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  authToken = await signIn(page, `e2e-g2-${Date.now()}-${testInfo.workerIndex}`);
});

async function openGrowth(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Growth & Career' })).toBeVisible();
}

test('skill with proficiency, owning goal and evidence link (A102/A103)', async ({ page }) => {
  await openGrowth(page);

  // Create a goal to attach the skill to.
  const goal = await http(page).post('/api/goals', {
    data: { id: crypto.randomUUID(), title: 'E2E Backend mastery' },
  });
  expect(goal.ok()).toBeTruthy();
  const note = await http(page).post('/api/notes', {
    data: { id: crypto.randomUUID(), title: 'E2E PG evidence' },
  });
  expect(note.ok()).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();

  // Create the skill through the UI.
  await page.getByRole('tab', { name: 'Skills', exact: true }).click();
  await page.getByRole('button', { name: 'New skill' }).click();
  const editor = page.locator('.goal-editor');
  await editor.getByPlaceholder('Skill name').fill('E2E Postgres');
  await editor.getByLabel('Proficiency').selectOption('4');
  await editor.getByLabel('Owning goal (optional)').selectOption({ label: 'E2E Backend mastery' });
  await editor.getByRole('button', { name: 'Save' }).click();

  const card = page.locator('.skill-card', { hasText: 'E2E Postgres' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('E2E Backend mastery');
  await expect(card.locator('.skill-dot--on')).toHaveCount(4);

  // Link the evidence note.
  await card.getByLabel('Link a note (evidence)…').selectOption({ label: 'E2E PG evidence' });
  await expect(card.locator('.goal-link')).toContainText('E2E PG evidence');
  await expect(card.locator('.goal-link')).toContainText('Note');

  // Deleting the owning goal frees the skill (goalId nulled, card stays).
  await http(page).delete(`/api/goals/${(await goal.json()).id}`);
  await page.reload();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();
  await page.getByRole('tab', { name: 'Skills', exact: true }).click();
  const freed = page.locator('.skill-card', { hasText: 'E2E Postgres' });
  await expect(freed).toBeVisible();
  await expect(freed).toContainText('(standalone)');
});

test('review, memo link, schedule-next idempotency and calendar hand-off (A104/A105)', async ({
  page,
}) => {
  await openGrowth(page);

  // Seed a memo to link.
  const memo = await http(page).post('/api/memos', {
    data: { id: crypto.randomUUID(), title: 'E2E Retro anchor', date: offsetKey(0) },
  });
  expect(memo.ok()).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Growth', exact: true }).click();

  // Create the review through the UI.
  await page.getByRole('tab', { name: 'Reviews', exact: true }).click();
  await page.getByRole('button', { name: 'New review' }).click();
  const editor = page.locator('.goal-editor');
  await editor.getByLabel('Goal title').fill('E2E Monthly retro');
  await editor.getByLabel('Review content…').fill('Shipped two slices.');
  await editor.getByRole('button', { name: 'Save' }).click();

  const card = page.locator('.review-card', { hasText: 'E2E Monthly retro' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Shipped two slices.');

  // Link the existing memo.
  await card.getByLabel('Link a memo…').selectOption({ index: 1 });
  await expect(card.locator('.goal-link')).toContainText('E2E Retro anchor');

  // Arrange the next review (+7 days) through the UI; the arranged pill shows.
  const next = offsetKey(7);
  await card.getByRole('button', { name: 'Schedule next review' }).click();
  await card.getByLabel('Next review date').fill(next);
  await card.getByRole('button', { name: 'Schedule next review' }).click();
  await expect(card.getByRole('button', { name: /Arranged for/ })).toBeVisible();

  // Idempotency at the API level: exactly one follow-up memo exists.
  const reviewList = (await (await http(page).get('/api/reviews')).json()) as {
    id: string;
    nextMemoId: string | null;
  }[];
  const review = reviewList.find((r) => r.nextMemoId)!;
  const repeat = await http(page).post(`/api/reviews/${review.id}/schedule-next-memo`, {
    data: { date: next },
  });
  expect(repeat.ok()).toBeTruthy();
  const memos = (await (
    await http(page).get(`/api/memos?from=${next}&to=${offsetKey(8)}`)
  ).json()) as { title: string }[];
  expect(memos.filter((m) => m.title === 'E2E Monthly retro（回顾）')).toHaveLength(1);

  // Open the arranged memo: Host switches to Calendar with the memo in view.
  await card.getByRole('button', { name: /Arranged for/ }).click();
  await expect(page.locator('.detail-panel')).toBeVisible();
  await expect(page.locator('.detail-panel').getByLabel('Title')).toHaveValue(
    'E2E Monthly retro（回顾）',
  );
});
