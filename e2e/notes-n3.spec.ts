import { expect, test, type Page } from '@playwright/test';
import { authedApi, signIn } from './auth';

/**
 * End-to-end coverage of the N3 cnblog-style editor: tabs + icon toolbar,
 * split view with divider and sync-scroll, autosave status label, the
 * localStorage draft backup (offline restore), drag/toolbar image upload
 * inserting markdown syntax, TeX toggle, and the publish form lifecycle
 * (draft / publish / schedule).
 */

let authToken = '';
const http = (page: Page) => authedApi(page, authToken);

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('chpli2-language', 'en');
    localStorage.removeItem('chpli2-notes-editor-prefs');
  });
  authToken = await signIn(page, `e2e-n3-${Date.now()}-${testInfo.workerIndex}`);
});

async function openNewNote(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByPlaceholder('Enter a title', { exact: true }).fill(title);
}

test('tabs, toolbar transforms, TOC and autosave status label', async ({ page }) => {
  await openNewNote(page, 'N3 toolbar');

  // Edit tab is active by default; source area is a mono textarea.
  await expect(page.getByRole('tab', { name: 'Edit', exact: true })).toHaveAttribute('aria-selected', 'true');
  const source = page.getByPlaceholder('Write in Markdown…');
  await source.fill('hello world');
  await expect(source).toHaveValue('hello world');

  // Bold wraps the selection.
  await source.selectText();
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(source).toHaveValue('**hello world**');

  // Table inserts a template with the header pre-selected.
  await source.fill('');
  await expect(source).toHaveValue('');
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(source).toHaveValue('| 列1 | 列2 |\n| --- | --- |\n|  |  |\n');

  // TOC collects the document headings.
  await source.fill('# Part one\n\ntext\n\n## Sub section\n');
  await expect(source).toHaveValue('# Part one\n\ntext\n\n## Sub section\n');
  await page.getByRole('button', { name: 'Table of contents' }).click();
  await expect(source).toHaveValue(
    '# Part one\n\ntext\n\n## Sub section\n- [Part one](#part-one)\n  - [Sub section](#sub-section)\n\n',
  );

  // Autosave cycles the status label and lands on "Backed up".
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('save-state')).toContainText('Backed up');
});

test('split view: divider, sync-scroll toggle and preview pane', async ({ page }) => {
  await openNewNote(page, 'N3 split');
  await page.getByPlaceholder('Write in Markdown…').fill('# Split heading');

  await page.getByRole('button', { name: 'Split view' }).click();
  const divider = page.getByRole('separator');
  await expect(divider).toBeVisible();
  // Both panes visible: source textarea and rendered preview.
  await expect(page.locator('.note-editor__preview h1')).toHaveText('Split heading');
  await expect(page.getByLabel('Sync scroll')).toBeVisible();

  // Exiting split returns to single-column edit mode.
  await page.getByRole('button', { name: 'Split view' }).click();
  await expect(page.getByRole('separator')).toHaveCount(0);
});

test('TeX toggle renders math in preview', async ({ page }) => {
  await openNewNote(page, 'N3 tex');
  await page.getByPlaceholder('Write in Markdown…').fill('$$E = mc^2$$');
  await page.getByRole('checkbox', { name: 'Math' }).check();
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.note-editor__preview .katex')).toBeVisible();
});

test('toolbar image upload inserts the note-image markdown syntax', async ({ page }) => {
  await openNewNote(page, 'N3 image');
  page.once('dialog', () => undefined);
  await page.locator('.note-editor__file').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });
  const source = page.getByPlaceholder('Write in Markdown…');
  await expect(source).toHaveValue(/!\[shot\.png\]\(note-image:\/\/[0-9a-f-]+\)\n/);

  // The preview resolves the note-image ref to an actual <img>.
  await page.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.note-editor__preview img')).toBeVisible();
});

test('localStorage draft backup restores unsaved content after a failed autosave', async ({ page }) => {
  await openNewNote(page, 'N3 backup');
  // Wait until the title autosaved so the note is discoverable by title.
  await expect
    .poll(async () => {
      const res = await http(page).get('/api/notes');
      const notes = (await res.json()) as { id: string; title: string }[];
      return notes.find((n) => n.title === 'N3 backup')?.id ?? '';
    })
    .not.toBe('');
  const noteId = await page.evaluate(async () => {
    const res = await fetch('/api/notes', { headers: { Authorization: `Bearer ${localStorage.getItem('chpli2-token')}` } });
    const notes = (await res.json()) as { id: string; title: string }[];
    return notes.find((n) => n.title === 'N3 backup')!.id;
  });

  // Kill every PATCH so the server autosave can never succeed.
  await page.route('**/api/notes/*', (route) => {
    if (route.request().method() === 'PATCH') return route.abort();
    return route.continue();
  });
  const source = page.getByPlaceholder('Write in Markdown…');
  await source.fill('offline content that never reaches the server');

  // The local backup lands within its debounce and the status turns "Unsaved".
  await page.waitForFunction(
    (id) => Object.keys(localStorage).some((k) => k === `chpli2-note-draft:${id}`),
    noteId,
  );
  await expect(page.getByTestId('save-state')).toContainText('Unsaved', { timeout: 15_000 });

  // Reload: the stranded draft is restored from localStorage, still dirty.
  await page.reload();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByText('N3 backup').click();
  await expect(page.getByPlaceholder('Write in Markdown…')).toHaveValue(
    'offline content that never reaches the server',
  );
  await expect(page.getByTestId('save-state')).toContainText('Unsaved');
});

test('publish form: metadata, publish and schedule lifecycle', async ({ page }) => {
  await openNewNote(page, 'N3 publish');

  // Publish-form metadata.
  await page.getByPlaceholder('Pick or type a category', { exact: true }).fill('技术随笔');
  await page.getByPlaceholder('Press Enter to add').fill('发布');
  await page.keyboard.press('Enter');
  await page.getByPlaceholder('Optional — the post opening is used when empty', { exact: true }).fill('摘要 ABC');
  await page.getByText('Advanced').click();
  await page.getByLabel('Allow comments').uncheck();
  await page.getByLabel('Pinned').check();
  await page.getByLabel('Show on home').check();
  await page.getByRole('checkbox', { name: 'Password access' }).check();
  await page.getByPlaceholder('Leave empty for open access', { exact: true }).fill('sesame');
  await expect(page.locator('.publish-form__status')).toHaveText('Draft');

  // Publish now.
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.publish-form__status')).toHaveText('Published');

  const onServer = async () => {
    const res = await http(page).get('/api/notes');
    const notes = (await res.json()) as Record<string, unknown>[];
    return notes.find((n) => n.title === 'N3 publish');
  };
  const published = await onServer();
  expect(published).toMatchObject({
    publishStatus: 'published',
    category: '技术随笔',
    tags: ['发布'],
    excerpt: '摘要 ABC',
    allowComments: false,
    pinned: true,
    showOnHome: true,
    hasAccessPassword: true,
  });
  expect(JSON.stringify(published)).not.toContain('sesame');
  expect(published!.publishedAt).toBeTruthy();

  // Schedule: tomorrow 09:00 local.
  await page.getByRole('button', { name: 'Schedule' }).click();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const pad = (v: number) => String(v).padStart(2, '0');
  await page
    .getByLabel('Scheduled time')
    .fill(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T09:00`);
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText(/Scheduled for/)).toBeVisible();
  const scheduled = await onServer();
  expect(scheduled!.publishStatus).toBe('scheduled');
  expect(scheduled!.publishAt).toBeTruthy();

  // Back to draft.
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.locator('.publish-form__status')).toHaveText('Draft');
  expect((await onServer())!.publishStatus).toBe('draft');
});
