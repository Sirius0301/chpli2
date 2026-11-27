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

  // Bold wraps the selection (blur-safe: read the selection, then wrap).
  await source.selectText();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(source).toHaveValue('**hello world**');

  // Table inserts a template with the header pre-selected.
  // 点击工具栏后焦点在按钮上且 rAF 恢复焦点可能延迟：先点击文本区再全选删除。
  await source.click();
  await source.press('ControlOrMeta+a');
  await source.press('Delete');
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
  const divider = page.getByRole('separator', { name: 'Split view' });
  await expect(divider).toBeVisible();
  // Both panes visible: source textarea and rendered preview.
  await expect(page.locator('.note-editor__preview h1')).toHaveText('Split heading');
  await expect(page.getByLabel('Sync scroll')).toBeVisible();

  // Exiting split returns to single-column edit mode.
  await page.getByRole('button', { name: 'Split view' }).click();
  await expect(page.getByRole('separator', { name: 'Split view' })).toHaveCount(0);
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
  await page.locator('.notes-home__card', { hasText: 'N3 backup' }).click();
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

test('reading view renders the note with publish meta; list shows badges', async ({ page }) => {
  await openNewNote(page, 'N3 reading');
  await page.getByPlaceholder('Write in Markdown…').fill('# 阅读标题\n\n正文 **内容**');
  await page.getByPlaceholder('Pick or type a category', { exact: true }).fill('随笔');
  await page.getByText('Advanced').click();
  await page.getByLabel('Pinned').check();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.publish-form__status')).toHaveText('Published');

  // List: pinned marker + published badge（先关闭编辑器回到 NotesHome 网格）。
  await page.getByRole('button', { name: 'Close' }).click();
  const item = page.locator('.notes-home__card', { hasText: 'N3 reading' });
  await expect(item.locator('.notes-list__status')).toHaveText('Published');
  // 置顶视觉：笔记出现在置顶栏（pin 图标随侧栏列表组件一并移除）。
  await expect(
    page.locator('.notes-home__section', { hasText: 'Pinned' }).locator('.notes-home__card', { hasText: 'N3 reading' }),
  ).toBeVisible();

  // Reading view: title, category chip, published chip, rendered body.
  // 网格断言后需重新打开笔记（刚才已关闭编辑器）才能使用工具栏。
  await page.locator('.notes-home__card', { hasText: 'N3 reading' }).click();
  await page.getByRole('button', { name: 'Reading view' }).click();
  const reading = page.getByRole('dialog', { name: 'Reading view' });
  await expect(reading.locator('.note-reading__title')).toHaveText('N3 reading');
  await expect(reading).toContainText('随笔');
  await expect(reading).toContainText('Published');
  await expect(reading.locator('.markdown-body h1')).toHaveText('阅读标题');
  await expect(reading.locator('.markdown-body strong')).toHaveText('内容');
  await page.keyboard.press('Escape');
  await expect(reading).toHaveCount(0);
});

test('rich text mode: WYSIWYG surface round-trips to Markdown', async ({ page }) => {
  await openNewNote(page, 'N3 rich');
  const source = page.getByPlaceholder('Write in Markdown…');
  await source.fill('# Rich doc\n\nSome text');
  await expect(source).toHaveValue('# Rich doc\n\nSome text');

  // Switch to rich text: the surface is seeded from the markdown.
  await page.getByLabel('Editor', { exact: true }).selectOption('rich');
  const rich = page.getByRole('textbox', { name: 'Write in Markdown…' });
  await expect(rich.locator('h1')).toHaveText('Rich doc');

  // Preview tab is disabled in rich mode (WYSIWYG).
  const previewTab = page.getByRole('tab', { name: 'Preview', exact: true });
  await expect(previewTab).toHaveAttribute('aria-disabled', 'true');

  // Type in the surface, then bold just the paragraph via the rich toolbar.
  await rich.click();
  await page.keyboard.type(' tail');
  await rich.locator('p').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await expect(rich.locator('p b, p strong')).toHaveCount(1);

  // Switch back: the round trip lands as Markdown in the source area.
  await page.getByLabel('Editor', { exact: true }).selectOption('markdown');
  await expect(source).toHaveValue(/# Rich doc/);
  await expect(source).toHaveValue(/\*\*Some text tail\*\*/);
});

test('sidebar filters: by category and by publish status (N3)', async ({ page }) => {
  await openNewNote(page, 'Filter A');
  await page.getByPlaceholder('Pick or type a category', { exact: true }).fill('技术');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.publish-form__status')).toHaveText('Published');

  await page.getByRole('button', { name: 'New note' }).click();
  // 等待创建往返完成、编辑器载入默认值后再填写（侧栏列表已移除）。
  await expect(page.getByPlaceholder('Enter a title', { exact: true })).toHaveValue('Untitled note');
  await page.getByPlaceholder('Enter a title', { exact: true }).fill('Filter B');
  await page.getByPlaceholder('Pick or type a category', { exact: true }).fill('生活');
  //  stays a draft. 侧栏列表已移除：显式保存草稿（分类落库），再关闭编辑器
  // 回到 NotesHome 后筛选断言才可见。
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('notes-home')).toBeVisible();

  // Category filter: only 生活 notes remain (list-scoped: wiki select also renders titles).
  const itemA = () => page.locator('.notes-home__card', { hasText: 'Filter A' });
  const itemB = () => page.locator('.notes-home__card', { hasText: 'Filter B' });
  await page.getByRole('checkbox', { name: /^生活/ }).check();
  await expect(itemB()).toBeVisible();
  await expect(itemA()).toHaveCount(0);

  // Status filter adds the ANDed dimension: drafts only (B is a draft).
  await page.getByRole('checkbox', { name: 'Draft', exact: true }).check();
  await expect(itemB()).toBeVisible();

  // Published + 生活 matches nothing -> 无匹配提示；clear filters restores.
  await page.getByRole('checkbox', { name: 'Draft', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Published', exact: true }).check();
  await expect(page.locator('.notes-home__empty')).toHaveText('No notes match the active filters');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(itemA()).toBeVisible();
  await expect(itemB()).toBeVisible();

  // 搜索框联动：关键词只命中 A（B 无关键词）；清空恢复。
  await page.getByLabel('Search title, body, tags…').fill('Filter A');
  await expect(itemA()).toBeVisible();
  await expect(itemB()).toHaveCount(0);
  await page.getByLabel('Search title, body, tags…').fill('');
  await expect(itemB()).toBeVisible();
});

test('home page shows published showOnHome notes as cards; click opens reading view', async ({ page }) => {
  await openNewNote(page, 'Home card note');
  await page.getByPlaceholder('Write in Markdown…').fill('# 首页卡片\n\n正文摘要内容应该出现');
  await page.getByText('Advanced').click();
  await page.getByLabel('Show on home').check();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.publish-form__status')).toHaveText('Published');

  await page.goto('/');
  const section = page.getByTestId('home-notes');
  await expect(section).toBeVisible();
  const card = section.locator('.home__note-card', { hasText: 'Home card note' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('正文摘要内容应该出现');

  await card.click();
  // Deep link lands in the notes module with the reading view open.
  await expect(page.getByRole('dialog', { name: 'Reading view' })).toBeVisible();
  await expect(page.locator('.note-reading__title')).toHaveText('Home card note');
  await expect(page.locator('.note-reading__body').locator('h1')).toHaveText('首页卡片');
});

test('NotesHome: pinned bar visibility and load more', async ({ page }) => {
  await openNewNote(page, 'Pinned note');
  await page.getByText('Advanced').click();
  await page.getByLabel('Pinned').check();
  await page.getByRole('button', { name: 'Save draft' }).click();

  // 关闭编辑器返回 NotesHome（侧栏列表已移除，取消选中走"关闭"按钮）。
  await page.getByRole('button', { name: 'Close' }).click();
  const home = page.getByTestId('notes-home');
  await expect(home).toBeVisible();
  const pinnedSection = home.locator('.notes-home__section', { hasText: 'Pinned' });
  await expect(pinnedSection.locator('.notes-home__card', { hasText: 'Pinned note' })).toBeVisible();

  // Unpin -> the pinned bar disappears entirely.
  await pinnedSection.locator('.notes-home__card', { hasText: 'Pinned note' }).click();
  await page.getByText('Advanced').click();
  await page.getByRole('checkbox', { name: 'Pinned', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(home).toBeVisible();
  await expect(home.locator('.notes-home__heading', { hasText: 'Pinned' })).toHaveCount(0);
});

test('NotesHome: load more pages through a large list', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('chpli2-language', 'en'));
  // Reuse the signed-in user from beforeEach; seed 23 notes via API.
  for (let i = 1; i <= 23; i++) {
    const res = await http(page).post('/api/notes', {
      data: { id: crypto.randomUUID(), title: `Bulk ${String(i).padStart(2, '0')}` },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const home = page.getByTestId('notes-home');
  await expect(home.locator('.notes-home__grid .notes-home__card')).toHaveCount(20);
  await home.getByRole('button', { name: 'Load more' }).click();
  await expect(home.locator('.notes-home__grid .notes-home__card')).toHaveCount(23);
  await expect(home.getByRole('button', { name: 'Load more' })).toHaveCount(0);
});

test('NotesHome toolbar: count badge, card/list views and three sorts', async ({ page }) => {
  // Three notes with distinct titles/categories/creation order.
  for (const [i, [title, category]] of [
    ['Alpha zebra', null],
    ['Beta mango', '生活'],
    ['Gamma alfa', '技术'],
  ].entries()) {
    const res = await http(page).post('/api/notes', {
      data: {
        id: crypto.randomUUID(),
        title,
        ...(category ? { category } : {}),
        body: `${title} body`,
      },
    });
    expect(res.ok(), `${title}: ${await res.text()}`).toBeTruthy();
    void i;
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  const home = page.getByTestId('notes-home');
  await expect(home).toBeVisible();

  // 数量徽标 = 非置顶笔记总数
  const all = (await (await http(page).get('/api/notes')).json()) as { pinned: boolean }[];
  await expect(page.getByTestId('notes-home-count')).toHaveText(String(all.filter((n) => !n.pinned).length));

  // 默认按日期：最新创建的在最前
  const grid = page.getByTestId('notes-home-list');
  await expect(grid.locator('.notes-home__card').first()).toContainText('Gamma alfa');

  // 按名称升序
  await page.getByLabel('Sort').selectOption('name');
  await expect(grid.locator('.notes-home__card').first()).toContainText('Alpha zebra');

  // 按分类：有分类的在前（再按更新时间倒序），无分类的垫底
  await page.getByLabel('Sort').selectOption('category');
  await expect(grid.locator('.notes-home__card').first()).toContainText('Gamma alfa');
  await expect(grid.locator('.notes-home__card').last()).toContainText('Alpha zebra');

  // 列表视图
  await page.getByRole('tab', { name: 'List', exact: true }).click();
  await expect(grid.locator('.notes-home__row-item')).toHaveCount(all.filter((n) => !n.pinned).length);

  // 视图偏好持久化
  await page.reload();
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByTestId('notes-home-list').locator('.notes-home__row-item').first()).toBeVisible();
});
