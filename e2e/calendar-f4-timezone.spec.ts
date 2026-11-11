import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end coverage of the Calendar F4 slice (timezone semantics):
 *  A21 a fixed-zone event created for Europe/Berlin renders converted to the
 *      viewer's timezone (Asia/Shanghai per playwright.config) and shows its
 *      own-zone wall time in the summary bubble
 *  A22 a floating event displays the same wall clock in any viewer timezone
 *  A23 a wall clock that does not exist in the selected zone (DST gap) is
 *      blocked in the form (E15)
 *  D2  switching an event's timezone keeps the wall clock (E20)
 *
 * All tests run in English. The database persists between runs, so every
 * title carries a timestamp.
 */

const pad = (value: number) => String(value).padStart(2, '0');

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A day safely inside the visible month grid / current week. */
function gridDay(offsetDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  if (date.getMonth() !== new Date().getMonth()) {
    date.setDate(date.getDate() - 2 * offsetDays);
  }
  return date;
}

interface CalendarDto {
  id: string;
  name: string;
  isDefault: boolean;
  readonly: boolean;
}

function zonedOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Berlin wall time -> UTC instant (offset taken at local noon, away from transitions). */
function berlinWallToUtc(day: string, hm: string): Date {
  const wall = new Date(`${day}T${hm}:00Z`).getTime();
  const offset = zonedOffsetMinutes('Europe/Berlin', new Date(`${day}T12:00:00Z`));
  return new Date(wall - offset * 60000);
}

async function listCalendars(page: Page): Promise<CalendarDto[]> {
  const response = await page.request.get('/api/calendar/calendars');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as CalendarDto[];
}

async function findEventByTitle(page: Page, title: string): Promise<{ id: string; startAt: string; timezone: string | null }> {
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 60);
  const response = await page.request.get(
    `/api/calendar/events?from=${from.toISOString()}&to=${to.toISOString()}`,
  );
  const events = (await response.json()) as { id: string; title: string; startAt: string; timezone: string | null }[];
  const found = events.find((e) => e.title === title);
  expect(found, `event ${title} exists`).toBeTruthy();
  return found!;
}

test.beforeEach(async ({ page }) => {
  // Run the UI tests in English (default is zh-CN).
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
});

test('A21: a Europe/Berlin event renders converted to the viewer timezone', async ({ page }) => {
  const title = `E2E-TZ-BERLIN-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  const day = gridDay(3);
  await page
    .locator(`.month-cell[data-day="${dayKey(day)}"]`)
    .click({ position: { x: 12, y: 40 } });
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Title').fill(title);
  await dialog.getByLabel('Timezone').selectOption('Europe/Berlin');
  await dialog.getByLabel('Starts').fill(`${dayKey(day)}T09:00`);
  await dialog.getByLabel('Ends').fill(`${dayKey(day)}T10:00`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // Stored as the Berlin instant (winter UTC+1 -> 08:00Z, summer UTC+2 -> 07:00Z).
  const expectedStart = berlinWallToUtc(dayKey(day), '09:00');
  const created = await findEventByTitle(page, title);
  expect(created.timezone).toBe('Europe/Berlin');
  expect(created.startAt).toBe(expectedStart.toISOString());

  // In the week view (Asia/Shanghai, UTC+8) the same instant shows converted,
  // and the bubble surfaces the Berlin wall time.
  const viewerTime = expectedStart.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
  const berlinTime = expectedStart.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
  await page.getByRole('tab', { name: 'Week' }).click();
  const block = page.locator('.week-event', { hasText: title });
  await expect(block).toHaveCount(1);
  await block.click();
  const popover = page.getByRole('dialog', { name: title });
  await expect(popover).toBeVisible();
  await expect(popover).toContainText(viewerTime);
  await expect(popover).toContainText('Europe/Berlin');
  await expect(popover).toContainText(berlinTime);
});

test('A22: a floating event shows the same wall clock in the viewer timezone', async ({ page }) => {
  const title = `E2E-TZ-FLOAT-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  const day = gridDay(4);
  await page
    .locator(`.month-cell[data-day="${dayKey(day)}"]`)
    .click({ position: { x: 12, y: 40 } });
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Title').fill(title);
  await dialog.getByLabel('Timezone').selectOption({ label: 'Floating time (follows this device)' });
  await dialog.getByLabel('Starts').fill(`${dayKey(day)}T09:00`);
  await dialog.getByLabel('Ends').fill(`${dayKey(day)}T09:30`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // Stored as the UTC wall clock; timezone is null (floating).
  const created = await findEventByTitle(page, title);
  expect(created.timezone).toBeNull();
  expect(created.startAt).toBe(`${dayKey(day)}T09:00:00.000Z`);

  await page.getByRole('tab', { name: 'Week' }).click();
  const block = page.locator('.week-event', { hasText: title });
  await expect(block).toHaveCount(1);
  await block.click();
  const popover = page.getByRole('dialog', { name: title });
  await expect(popover).toBeVisible();
  // The viewer (Shanghai) sees the same 9:00 wall clock...
  await expect(popover).toContainText('9:00 AM');
  // ...marked as floating.
  await expect(popover).toContainText('Floating time');
});

test('A23/E15: a DST-gap wall clock is blocked in the form', async ({ page }) => {
  const title = `E2E-TZ-GAP-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  const day = gridDay(5);
  await page
    .locator(`.month-cell[data-day="${dayKey(day)}"]`)
    .click({ position: { x: 12, y: 40 } });
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Title').fill(title);
  await dialog.getByLabel('Timezone').selectOption('Europe/Berlin');
  // 2026-03-29 02:30 does not exist in Berlin (clocks jump 02:00 -> 03:00).
  await dialog.getByLabel('Starts').fill('2026-03-29T02:30');
  await dialog.getByLabel('Ends').fill('2026-03-29T03:30');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(
    dialog.getByText(/does not exist in the selected timezone/),
  ).toBeVisible();
  await expect(dialog).toBeVisible(); // stays open, nothing persisted
  const events = await page.request.get(
    `/api/calendar/events?from=2026-03-28T00:00:00Z&to=2026-03-31T00:00:00Z`,
  );
  expect(
    ((await events.json()) as { title: string }[]).find((e) => e.title === title),
  ).toBeUndefined();
});

test('D2/E20: switching the event timezone keeps the wall clock', async ({ page }) => {
  const title = `E2E-TZ-SWITCH-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  const day = gridDay(6);
  await page
    .locator(`.month-cell[data-day="${dayKey(day)}"]`)
    .click({ position: { x: 12, y: 40 } });
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Title').fill(title);
  await dialog.getByLabel('Timezone').selectOption('Europe/Berlin');
  await dialog.getByLabel('Starts').fill(`${dayKey(day)}T09:00`);
  await dialog.getByLabel('Ends').fill(`${dayKey(day)}T10:00`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  const created = await findEventByTitle(page, title);
  expect(created.startAt).toBe(berlinWallToUtc(dayKey(day), '09:00').toISOString());

  // Re-open and switch only the timezone: the wall clock (09:00) is kept.
  // (Use the month bar: the event day may sit outside the current week.)
  await page.locator('.month-bar', { hasText: title }).click();
  const popover = page.getByRole('dialog', { name: title });
  await popover.getByRole('button', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit event' });
  await editDialog.getByLabel('Timezone').selectOption('Asia/Shanghai');
  // The inputs still read 09:00; saving reinterprets them in Shanghai.
  await expect(editDialog.getByLabel('Starts')).toHaveValue(`${dayKey(day)}T09:00`);
  await editDialog.getByRole('button', { name: 'Save' }).click();
  await expect(editDialog).toBeHidden();

  const switched = await findEventByTitle(page, title);
  expect(switched.timezone).toBe('Asia/Shanghai');
  expect(switched.startAt).toBe(`${dayKey(day)}T01:00:00.000Z`); // 09:00 CST
});
