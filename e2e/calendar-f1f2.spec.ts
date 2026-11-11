import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end coverage of the Calendar F1+F2 slice:
 *  A2  new events land in the default calendar
 *  A5  deleting a calendar requires choosing the fate of its events (E1),
 *      and cancelling the dialog changes nothing
 *  A9  multi-day all-day events render as continuous bars
 *  A13 reminder presets attach to events; custom offsets > 30 days are
 *      blocked in the UI (E4)
 *  A14 the sidebar due-reminder list shows upcoming reminders
 *
 * All tests run in English. The database persists between runs, so every
 * title/calendar name carries a timestamp.
 */

const pad = (value: number) => String(value).padStart(2, '0');

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local datetime input value (Asia/Shanghai in the Playwright config). */
function localIso(date: Date): string {
  return (
    `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00` +
    `${date.getTimezoneOffset() <= 0 ? '+' : '-'}${pad(Math.abs(date.getTimezoneOffset()) / 60)}:${pad(Math.abs(date.getTimezoneOffset()) % 60)}`
  );
}

/** A local Date at the given wall-clock time, n days from now. */
function futureAt(daysAhead: number, hours: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

interface CalendarDto {
  id: string;
  name: string;
  isDefault: boolean;
  readonly: boolean;
}

async function listCalendars(page: Page): Promise<CalendarDto[]> {
  const response = await page.request.get('/api/calendar/calendars');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as CalendarDto[];
}

async function createEventViaApi(
  page: Page,
  calendarId: string,
  title: string,
  startAt: Date,
  endAt: Date,
  allDay = false,
): Promise<void> {
  const response = await page.request.post('/api/calendar/events', {
    data: {
      id: crypto.randomUUID(),
      calendarId,
      title,
      startAt: allDay
        ? new Date(Date.UTC(startAt.getFullYear(), startAt.getMonth(), startAt.getDate())).toISOString()
        : localIso(startAt),
      endAt: allDay
        ? new Date(
            Date.UTC(endAt.getFullYear(), endAt.getMonth(), endAt.getDate()) + 86_400_000,
          ).toISOString()
        : localIso(endAt),
      allDay,
    },
  });
  expect(response.status()).toBe(201);
}

/** A day cell in the current month grid, safely inside the visible 6 weeks. */
function gridDay(offsetDays: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  if (date.getMonth() !== new Date().getMonth()) {
    date.setDate(date.getDate() - 2 * offsetDays);
  }
  return date;
}

test.beforeEach(async ({ page }) => {
  // Run the UI tests in English (default is zh-CN).
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
});

test('A2/A13/A14: creates an event in the default calendar with a reminder', async ({
  page,
}) => {
  const title = `E2E-EVT-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  // Open the create modal from an empty day cell.
  const day = gridDay(3);
  await page
    .locator(`.month-cell[data-day="${dayKey(day)}"]`)
    .click({ position: { x: 12, y: 40 } });
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Title').fill(title);
  await dialog.getByRole('button', { name: 'Add reminder' }).click();
  await expect(dialog.locator('.reminder-row')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  // The event renders as a bar in the month grid.
  await expect(page.locator('.month-bar', { hasText: title })).toHaveCount(1);

  // A2: the API shows it saved into the default calendar.
  const calendars = await listCalendars(page);
  const defaultCalendar = calendars.find((c) => c.isDefault && !c.readonly)!;
  const eventsResponse = await page.request.get(
    `/api/calendar/events?from=${futureAt(-7, 0, 0).toISOString()}&to=${futureAt(30, 0, 0).toISOString()}`,
  );
  const events = (await eventsResponse.json()) as { title: string; calendarId: string; id: string }[];
  const created = events.find((e) => e.title === title);
  expect(created).toBeTruthy();
  expect(created!.calendarId).toBe(defaultCalendar.id);

  // A13: the reminder was stored with the preset day offset.
  const reminderResponse = await page.request.get(
    `/api/calendar/events/${created!.id}/reminders`,
  );
  const reminders = (await reminderResponse.json()) as { offsetDays: number; preset: string }[];
  expect(reminders).toEqual([expect.objectContaining({ offsetDays: 1, preset: 'day' })]);

  // A14: the sidebar due list shows the upcoming reminder.
  await expect(page.locator('.due-item', { hasText: title })).toHaveCount(1);
});

test('A5/E1: deleting a calendar asks where the events go; cancel keeps everything', async ({
  page,
}) => {
  const calName = `E2E-CAL-${Date.now()}`;
  const eventTitle = `E2E-CALEVT-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  // Create a second calendar via the UI.
  await page.getByRole('button', { name: '+' }).click();
  const createDialog = page.getByRole('dialog', { name: 'New calendar' });
  await createDialog.getByLabel('Name').fill(calName);
  await createDialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.calendar-list', { hasText: calName })).toBeVisible();

  // Put an event into it via the API (the slice's UI coverage for event
  // creation in a specific calendar is the select box, exercised elsewhere).
  const newCalendar = (await listCalendars(page)).find((c) => c.name === calName)!;
  await createEventViaApi(page, newCalendar.id, eventTitle, futureAt(2, 10, 0), futureAt(2, 11, 0));

  // Open the delete dialog and cancel: nothing changes.
  await page
    .getByRole('button', { name: `Delete ${calName}` })
    .click();
  const deleteDialog = page.getByRole('dialog', { name: `Delete calendar "${calName}"` });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog.getByText(/has 1 event/)).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(page.locator('.calendar-list', { hasText: calName })).toBeVisible();
  let eventsResponse = await page.request.get(
    `/api/calendar/events?from=${futureAt(-1, 0, 0).toISOString()}&to=${futureAt(7, 0, 0).toISOString()}&calendar_ids=${newCalendar.id}`,
  );
  expect((await eventsResponse.json()) as unknown[]).toHaveLength(1);

  // Delete for real, choosing to delete the events together with the calendar.
  await page.getByRole('button', { name: `Delete ${calName}` }).click();
  await deleteDialog.getByLabel('Delete events with it').check();
  await deleteDialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.calendar-list', { hasText: calName })).toHaveCount(0);

  eventsResponse = await page.request.get(
    `/api/calendar/events?from=${futureAt(-1, 0, 0).toISOString()}&to=${futureAt(7, 0, 0).toISOString()}&calendar_ids=${newCalendar.id}`,
  );
  expect((await eventsResponse.json()) as unknown[]).toHaveLength(0);
});

test('A9/E6: a multi-day all-day event renders as one continuous bar', async ({ page }) => {
  const title = `E2E-ALLDAY-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  const calendars = await listCalendars(page);
  const defaultCalendar = calendars.find((c) => c.isDefault && !c.readonly)!;
  const start = gridDay(5);
  const end = gridDay(7); // inclusive last day -> 3-day bar
  await createEventViaApi(page, defaultCalendar.id, title, start, end, true);

  const bar = page.locator('.month-bar', { hasText: title });
  await expect(bar).toHaveCount(1);

  // Clicking the bar opens the summary bubble with the date range (A11).
  await bar.click();
  const popover = page.getByRole('dialog', { name: title });
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('–');
  await popover.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit event' })).toBeVisible();
  await expect(page.getByLabel('All-day')).toBeChecked();
});

test('E4: custom reminders beyond one month are blocked', async ({ page }) => {
  const title = `E2E-REM-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();

  const day = gridDay(4);
  await page
    .locator(`.month-cell[data-day="${dayKey(day)}"]`)
    .click({ position: { x: 12, y: 40 } });
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await dialog.getByLabel('Title').fill(title);

  await dialog.getByRole('button', { name: 'Add reminder' }).click();
  await dialog.locator('.reminder-row select').selectOption('custom');
  await dialog.getByLabel('Days before').fill('31');
  await expect(dialog.getByText('At most one month (30 days) ahead')).toBeVisible();

  // Saving is refused and the modal stays open.
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'At most one month (30 days) ahead',
  );
  await expect(dialog).toBeVisible();

  // Nothing was created.
  const eventsResponse = await page.request.get(
    `/api/calendar/events?from=${futureAt(-1, 0, 0).toISOString()}&to=${futureAt(7, 0, 0).toISOString()}`,
  );
  const events = (await eventsResponse.json()) as { title: string }[];
  expect(events.some((e) => e.title === title)).toBe(false);
});
