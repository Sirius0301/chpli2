import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end coverage of the Travel <-> Calendar vertical slice:
 *  1. Full loop: PLAN trip -> COUNTRY-level transport -> calendar sync
 *     (idempotent) -> edit planned time (still one event) -> reload
 *     (persistence) -> guarded delete (cancel keeps, confirm removes).
 *  2. Domain rule: MEMORY trips never sync to the calendar.
 *  3. Validation: same-endpoint and cross-level routes are blocked in the UI
 *     and rejected by the API with a stable errorCode.
 *  4. i18n: navigation labels switch between 中文 / English / Deutsch.
 *
 * All tests run in English; the i18n test manages language itself.
 * Note: the API consumes transport outbox events every 200 ms, so the
 * calendar UI is only opened after the REST API already reflects the
 * expected state (expect.poll), avoiding races with the one-shot list fetch.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** Formats a Date the same way the apps render datetimes (en locale, local tz). */
function fmt(date: Date): string {
  return date.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Value for <input type="datetime-local"> from a Date's local fields. */
function localInput(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** A future local Date at the given wall-clock time. */
function futureAt(daysAhead: number, hours: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

interface GeoIds {
  chinaId: string;
  germanyId: string;
  japanId: string;
}

async function fetchGeoIds(page: Page): Promise<GeoIds> {
  const response = await page.request.get('/api/travel/countries');
  expect(response.ok()).toBeTruthy();
  const countries = (await response.json()) as { id: string; name: string }[];
  const byName = (name: string) => {
    const country = countries.find((c) => c.name === name);
    expect(country, `seed country ${name} must exist`).toBeTruthy();
    return country!.id;
  };
  return { chinaId: byName('China'), germanyId: byName('Germany'), japanId: byName('Japan') };
}

/** Calendar event titles look like "FLIGHT: China -> Japan". */
function eventTitle(originName: string, destinationName: string): string {
  return `FLIGHT: ${originName} -> ${destinationName}`;
}

interface CalendarEventDto {
  title: string;
  startsAt: string;
  source: { id: string; tripId: string };
}

async function listEvents(page: Page): Promise<CalendarEventDto[]> {
  const response = await page.request.get('/api/calendar/events');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as CalendarEventDto[];
}

/** Polls the REST API until `predicate` matches exactly `count` events. */
async function waitForEventCount(
  page: Page,
  predicate: (event: CalendarEventDto) => boolean,
  count: number,
): Promise<CalendarEventDto[]> {
  let matched: CalendarEventDto[] = [];
  await expect
    .poll(async () => {
      matched = (await listEvents(page)).filter(predicate);
      return matched.length;
    }, { intervals: [100, 250, 500], timeout: 15_000 })
    .toBe(count);
  return matched;
}

/** Removes leftover transports from previously failed runs so counts stay exact. */
async function cleanupRouteEvents(
  page: Page,
  originName: string,
  destinationName: string,
): Promise<void> {
  const events = await listEvents(page);
  for (const event of events.filter((e) => e.title === eventTitle(originName, destinationName))) {
    await page.request.delete(`/api/travel/transports/${event.source.id}`);
  }
}

test.beforeEach(async ({ page }) => {
  // Run the UI tests in English (default is zh-CN).
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
});

// ---------------------------------------------------------------------------
// Helpers driving the UI
// ---------------------------------------------------------------------------

async function createTripViaUi(page: Page, title: string, type: 'Plan' | 'Memory'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Travel', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('radio', { name: type }).check();
  await page.getByRole('button', { name: 'Create trip' }).click();
  await expect(page.locator('.trip-card', { hasText: title })).toHaveCount(1);
}

async function openTrip(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Travel', exact: true }).click();
  await page
    .locator('.trip-card', { hasText: title })
    .getByRole('button', { name: 'Open' })
    .click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function fillCountryEndpoint(
  page: Page,
  side: 'Origin' | 'Destination',
  countryName: string,
): Promise<void> {
  const endpoint = page.locator('fieldset.endpoint', { hasText: side });
  await endpoint.getByLabel(`${side} Country`).selectOption({ label: countryName });
}

async function fillPlannedTimes(page: Page, departure: Date, arrival: Date): Promise<void> {
  await page.getByLabel('Planned departure').fill(localInput(departure));
  await page.getByLabel('Planned arrival').fill(localInput(arrival));
}

/** Opens the calendar UI and asserts how many events match `routeText`. */
async function expectCalendarEvents(page: Page, routeText: string, count: number): Promise<void> {
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.event-item', { hasText: routeText })).toHaveCount(count);
}

// ---------------------------------------------------------------------------
// 1. Full loop: create -> sync -> edit (idempotent) -> persist -> guarded delete
// ---------------------------------------------------------------------------

test('PLAN trip transport syncs to calendar; edit stays idempotent; delete removes event', async ({
  page,
}) => {
  const geo = await fetchGeoIds(page);
  // Pick two distinct countries from the seeded reference data.
  const originName = 'China';
  const destinationName = 'Japan';
  const routeText = `${originName} -> ${destinationName}`;
  await cleanupRouteEvents(page, originName, destinationName);

  const tripTitle = `E2E-${Date.now()}`;
  const departure = futureAt(30, 10, 0);
  const arrival = futureAt(30, 16, 30);
  const updatedDeparture = futureAt(31, 9, 15);
  const updatedArrival = futureAt(31, 12, 45);

  // -- Create a PLAN trip and add a COUNTRY-level transport segment.
  await createTripViaUi(page, tripTitle, 'Plan');
  await openTrip(page, tripTitle);

  // Sync toggle defaults to on for PLAN trips.
  await expect(page.getByRole('checkbox', { name: 'Sync to calendar' })).toBeChecked();

  // Slow the create request down so we can observe the "no double submit" guard.
  await page.route('**/api/travel/trips/*/transports', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await fillCountryEndpoint(page, 'Origin', originName);
  await fillCountryEndpoint(page, 'Destination', destinationName);
  await fillPlannedTimes(page, departure, arrival);

  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toHaveText('Add');
  await expect(submit).toBeEnabled();
  await submit.click();

  // While submitting, the button shows the busy label and is disabled ...
  await expect(submit).toHaveText('Submitting…');
  await expect(submit).toBeDisabled();
  // ... and afterwards exactly one transport exists (no duplicate submit).
  await expect(page.locator('.transport-item')).toHaveCount(1);
  await expect(page.locator('.transport-item')).toContainText(
    new RegExp(`${originName}\\s*→\\s*${destinationName}`),
  );
  await page.unroute('**/api/travel/trips/*/transports');

  // Calendar API shows exactly one matching event (outbox sync is idempotent).
  const initialEvents = await waitForEventCount(
    page,
    (event) => event.title === eventTitle(originName, destinationName),
    1,
  );
  expect(new Date(initialEvents[0]!.startsAt).getTime()).toBe(departure.getTime());

  // -- Calendar UI shows the single event with the planned time.
  await expectCalendarEvents(page, routeText, 1);
  await expect(
    page.locator('.event-item', { hasText: routeText }).locator('.event-item__time'),
  ).toHaveText(`${fmt(departure)} – ${fmt(arrival)}`);

  // -- Edit the planned time: still exactly one event, with the new time.
  await openTrip(page, tripTitle);
  await page.locator('.transport-item').getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit transport segment' })).toBeVisible();
  await fillPlannedTimes(page, updatedDeparture, updatedArrival);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.transport-item')).toHaveCount(1);

  const updatedEvents = await waitForEventCount(
    page,
    (event) =>
      event.title === eventTitle(originName, destinationName) &&
      new Date(event.startsAt).getTime() === updatedDeparture.getTime(),
    1,
  );
  expect(updatedEvents).toHaveLength(1); // idempotent: update, not duplicate
  await expectCalendarEvents(page, routeText, 1);
  await expect(
    page.locator('.event-item', { hasText: routeText }).locator('.event-item__time'),
  ).toHaveText(`${fmt(updatedDeparture)} – ${fmt(updatedArrival)}`);

  // -- Reload: trip and event persist (server-side state survives a refresh).
  await page.reload();
  await openTrip(page, tripTitle);
  await expect(page.locator('.transport-item')).toHaveCount(1);
  await expect(page.locator('.transport-item')).toContainText(
    new RegExp(`${originName}\\s*→\\s*${destinationName}`),
  );
  await expect(page.locator('.transport-item')).toContainText(fmt(updatedDeparture));
  await expectCalendarEvents(page, routeText, 1);

  // -- Delete guard: cancelling the dialog keeps the transport (and event).
  await openTrip(page, tripTitle);
  await page.locator('.transport-item').getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete transport segment' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.transport-item')).toHaveCount(1);
  await waitForEventCount(page, (event) => event.title === eventTitle(originName, destinationName), 1);

  // -- Confirming the dialog deletes the transport and its calendar event.
  await page.locator('.transport-item').getByRole('button', { name: 'Delete' }).click();
  await page
    .getByRole('dialog', { name: 'Delete transport segment' })
    .getByRole('button', { name: 'Confirm delete' })
    .click();
  await expect(page.locator('.transport-item')).toHaveCount(0);
  await waitForEventCount(page, (event) => event.title === eventTitle(originName, destinationName), 0);
  await expectCalendarEvents(page, routeText, 0);

  // Trip itself still exists after its transport was deleted.
  await openTrip(page, tripTitle);
  await expect(page.getByText('No transport segments yet — add the first one!')).toBeVisible();
  expect(geo).toBeTruthy(); // geo ids fetched up-front keep the test self-contained
});

// ---------------------------------------------------------------------------
// 2. Domain rule: MEMORY trips never sync to the calendar
// ---------------------------------------------------------------------------

test('MEMORY trip transport never appears in the calendar', async ({ page }) => {
  await cleanupRouteEvents(page, 'China', 'Germany');

  const tripTitle = `E2E-MEM-${Date.now()}`;
  await createTripViaUi(page, tripTitle, 'Memory');
  await openTrip(page, tripTitle);

  // MEMORY trips offer no sync toggle.
  await expect(page.getByRole('checkbox', { name: 'Sync to calendar' })).toHaveCount(0);

  await fillCountryEndpoint(page, 'Origin', 'China');
  await fillCountryEndpoint(page, 'Destination', 'Germany');
  await fillPlannedTimes(page, futureAt(20, 8, 0), futureAt(20, 14, 0));
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.transport-item')).toHaveCount(1);

  // The outbox dispatcher runs every 200 ms; give it time, then assert absence.
  await page.waitForTimeout(1_000);
  await waitForEventCount(page, (event) => event.title === eventTitle('China', 'Germany'), 0);
  await expectCalendarEvents(page, 'China -> Germany', 0);
});

// ---------------------------------------------------------------------------
// 3. Validation: invalid routes blocked in the UI and rejected by the API
// ---------------------------------------------------------------------------

test('invalid routes are blocked: same endpoint and cross-level', async ({ page }) => {
  // -- UI: same endpoint -> inline error, submit disabled.
  const tripTitle = `E2E-VAL-${Date.now()}`;
  await createTripViaUi(page, tripTitle, 'Plan');
  await openTrip(page, tripTitle);

  await fillCountryEndpoint(page, 'Origin', 'China');
  await fillCountryEndpoint(page, 'Destination', 'China');
  const submit = page.getByRole('button', { name: 'Add' });
  await expect(page.getByRole('alert')).toContainText(
    'Origin and destination must be different',
  );
  await expect(submit).toBeDisabled();

  // -- UI: cross-level route (COUNTRY -> CITY) -> inline error, submit disabled.
  // Switching the destination level resets its child selections, so re-select
  // the country before the city can be chosen.
  const destination = page.locator('fieldset.endpoint', { hasText: 'Destination' });
  await destination.getByLabel('Destination Level').selectOption('CITY');
  await destination.getByLabel('Destination Country').selectOption({ label: 'China' });
  await destination.getByLabel('Destination City').selectOption({ label: 'Beijing' });
  await expect(page.getByRole('alert')).toContainText(
    'Origin and destination must use the same level',
  );
  await expect(submit).toBeDisabled();
  await expect(page.locator('.transport-item')).toHaveCount(0);

  // -- API: cross-level route is rejected with 400 + stable errorCode.
  const geo = await fetchGeoIds(page);
  const citiesResponse = await page.request.get(`/api/travel/countries/${geo.chinaId}/cities`);
  const cities = (await citiesResponse.json()) as { id: string; name: string }[];
  const beijing = cities.find((city) => city.name === 'Beijing')!;

  const tripResponse = await page.request.post('/api/travel/trips', {
    data: { title: `E2E-API-${Date.now()}`, type: 'PLAN' },
  });
  expect(tripResponse.status()).toBe(201);
  const trip = (await tripResponse.json()) as { id: string };

  const crossLevelResponse = await page.request.post(
    `/api/travel/trips/${trip.id}/transports`,
    {
      data: {
        mode: 'FLIGHT',
        origin: { level: 'COUNTRY', id: geo.chinaId },
        destination: { level: 'CITY', id: beijing.id },
        plannedDepartureAt: futureAt(10, 9, 0).toISOString(),
        plannedArrivalAt: futureAt(10, 12, 0).toISOString(),
        syncToCalendar: true,
      },
    },
  );
  expect(crossLevelResponse.status()).toBe(400);
  expect((await crossLevelResponse.json()).errorCode).toBe('ROUTE_LEVEL_MISMATCH');

  // -- API: same endpoint is rejected with 400 + stable errorCode.
  const sameEndpointResponse = await page.request.post(
    `/api/travel/trips/${trip.id}/transports`,
    {
      data: {
        mode: 'FLIGHT',
        origin: { level: 'COUNTRY', id: geo.chinaId },
        destination: { level: 'COUNTRY', id: geo.chinaId },
        plannedDepartureAt: futureAt(10, 9, 0).toISOString(),
        plannedArrivalAt: futureAt(10, 12, 0).toISOString(),
        syncToCalendar: true,
      },
    },
  );
  expect(sameEndpointResponse.status()).toBe(400);
  expect((await sameEndpointResponse.json()).errorCode).toBe('ROUTE_SAME_ENDPOINT');
});

// ---------------------------------------------------------------------------
// 4. i18n: navigation labels react to the language switcher
// ---------------------------------------------------------------------------

test('language switcher updates navigation in zh-CN, English and Deutsch', async ({
  browser,
}) => {
  // Use a fresh context: the suite-wide beforeEach init script would force 'en'
  // on every navigation, overriding the zh-CN step below.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  // Start from the zh-CN default.
  await expect(page.getByRole('button', { name: '首页' })).toBeVisible();
  await expect(page.getByRole('button', { name: '行程', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '日历', exact: true })).toBeVisible();

  // Switch to English; module UI follows as well.
  await page.getByLabel('语言').selectOption('en');
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Travel', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Travel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trips' })).toBeVisible();

  // Switch to Deutsch.
  await page.getByLabel('Language').selectOption('de');
  await expect(page.getByRole('button', { name: 'Startseite' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reisen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kalender' })).toBeVisible();
  await page.getByRole('button', { name: 'Reisen' }).click();
  await expect(page.getByRole('heading', { name: 'Reisen' })).toBeVisible();
  await context.close();
});
