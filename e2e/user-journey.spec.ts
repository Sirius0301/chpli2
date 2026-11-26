/**
 * 用户视角端到端验证：注册全新账号，完全通过 UI 在各模块创建数据，
 * 并验证每个模块页面如期显示。运行：npx playwright test user-journey.spec.ts
 */
import { expect, test } from '@playwright/test';
import { signIn } from './auth';

const API = 'http://localhost:4000';
let authToken = '';

test.beforeAll(async () => {
  // 模拟真实用户注册（API register 即产品内的注册端点）
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `uj-${Date.now()}`, password: 'user-journey-123' }),
  });
  const { token, user } = (await res.json()) as { token: string; user: unknown };
  authToken = token;
  process.env.UJ_TOKEN = token;
  process.env.UJ_USER = JSON.stringify(user);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('chpli2-token', t);
      localStorage.setItem('chpli2-user', u);
      localStorage.setItem('chpli2-language', 'zh');
    },
    [process.env.UJ_TOKEN!, process.env.UJ_USER!] as const,
  );
});

async function openModule(page: import('@playwright/test').Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name, exact: true }).click();
}

// ---------- 1. 日历：用户点击日期格创建备忘（含自定义重复回归场景） ----------
test('日历：创建普通备忘 + 自定义重复备忘，三视图与到期侧栏验证', async ({ page }) => {
  await openModule(page, '日历');
  await expect(page.getByRole('tab', { name: '周', exact: true })).toBeVisible();

  // 今天：普通备忘，高优先级
  await page.locator('.day-col--today .day-col__body').click();
  const panel = page.locator('.detail-panel');
  await expect(panel).toBeVisible();
  await panel.getByLabel('标题').fill('给妈妈买生日礼物');
  await panel.getByLabel('优先级').selectOption('high');
  await panel.getByRole('button', { name: '保存' }).click();
  await expect(panel).toHaveCount(0);
  const gift = page.locator('.day-col--today .memo-chip', { hasText: '给妈妈买生日礼物' });
  await expect(gift).toBeVisible();
  await expect(gift).toHaveClass(/memo-chip--high/);

  // 明天：自定义重复（周一/三/五）。明天的星期不在所选集合 → 回归场景：开始日必须可见
  const tomorrowCol = page.locator('.day-col--today + .day-col');
  await tomorrowCol.locator('.day-col__body').click();
  await panel.getByLabel('标题').fill('每周一/三/五 健身课');
  await panel.getByLabel('重复').selectOption('custom');
  const days = panel.getByRole('group', { name: '重复于（星期）' });
  await days.getByText('一', { exact: true }).click();
  await days.getByText('三', { exact: true }).click();
  await days.getByText('五', { exact: true }).click();
  await panel.getByRole('button', { name: '保存' }).click();
  await expect(panel).toHaveCount(0);
  const gym = tomorrowCol.locator('.memo-chip', { hasText: '健身课' });
  await expect(gym).toBeVisible();
  await expect(gym.locator('.memo-chip__repeat')).toBeVisible();

  // 勾选完成 → 划线；即将到期侧栏同步减少。
  // 到期卡片异步加载：等健身课条目出现即已稳定，再取基数做相对断言
  //（实例数随星期几变化，不能硬编码）。
  await expect(page.locator('.memo-due', { hasText: '健身课' }).first()).toBeVisible();
  const dueBefore = Number(await page.getByTestId('due-total').innerText());
  await gift.getByRole('checkbox').click();
  await expect(gift).toHaveClass(/memo-chip--done/);
  await expect
    .poll(async () => Number(await page.getByTestId('due-total').innerText()))
    .toBe(dueBefore - 1);

  // 日视图 / 月视图同样可见
  await page.getByRole('tab', { name: '日', exact: true }).click();
  await expect(page.locator('.day-col .memo-chip', { hasText: '给妈妈买生日礼物' })).toBeVisible();
  await page.getByRole('tab', { name: '月', exact: true }).click();
  await expect(
    page.locator('.month-view__cell--today .memo-chip', { hasText: '给妈妈买生日礼物' }),
  ).toBeVisible();
});

// ---------- 2. 笔记：新建 markdown 笔记，验证渲染与列表 ----------
test('笔记：创建 markdown 笔记并验证预览渲染', async ({ page }) => {
  await openModule(page, '笔记');
  await page.getByRole('button', { name: '新建笔记' }).click();
  await page.getByPlaceholder('输入标题', { exact: true }).fill('五一旅行计划');
  const body = '# 五一旅行计划\n\n- 京都\n- 大阪\n\n**预算 8000 元**\n\n```\nssh demo\n```';
  await page.getByPlaceholder('以 Markdown 记录…', { exact: true }).fill(body);
  await page.getByRole('tab', { name: '预览', exact: true }).click();
  await expect(page.locator('.note-editor h1', { hasText: '五一旅行计划' })).toBeVisible();
  await expect(page.locator('.note-editor strong', { hasText: '预算 8000 元' })).toBeVisible();
  await expect(page.locator('.note-editor li', { hasText: '京都' })).toBeVisible();
  // 列表中出现该笔记
  await expect(page.locator('.notes-list', { hasText: '五一旅行计划' })).toBeVisible();
});

// ---------- 3. 书签：新建书签并验证列表 ----------
test('书签：添加书签并验证展示', async ({ page }) => {
  await openModule(page, '书签');
  await page.getByRole('button', { name: '新建书签' }).click();
  const editor = page.locator('.bm-editor');
  await editor.getByPlaceholder('名称', { exact: true }).fill('Vite 官方文档');
  await editor.getByPlaceholder('https://…', { exact: true }).fill('https://vite.dev');
  await editor.getByRole('button', { name: '保存' }).click();
  // 产品行为：保存后编辑器保持打开（编辑模式），直接验证列表卡片
  const item = page.locator('.bm-card, .bm-row', { hasText: 'Vite 官方文档' });
  await expect(item).toBeVisible();
  await expect(item).toContainText('vite.dev');
});

// ---------- 4. 成长：新建目标并验证 ----------
test('成长：创建目标与技能并验证展示', async ({ page }) => {
  await openModule(page, '成长');
  await page.getByRole('button', { name: '新建目标' }).click();
  const editor = page.locator('.goal-editor');
  await editor.getByPlaceholder('目标名称', { exact: true }).fill('2027 跑完半程马拉松');
  await editor.getByRole('button', { name: '保存' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.goal-list', { hasText: '半程马拉松' })).toBeVisible();

  // 技能页
  await page.getByRole('tab', { name: '技能', exact: true }).click();
  await page.getByRole('button', { name: '新建技能' }).click();
  const sk = page.locator('.goal-editor'); // SkillEditor 复用 goal-editor 样式
  await sk.getByPlaceholder('技能名称', { exact: true }).fill('跑步');
  await sk.getByRole('button', { name: '保存' }).click();
  await expect(page.locator('.skill-list', { hasText: '跑步' })).toBeVisible();
});

// ---------- 5. 行程：新建行程并验证 ----------
test('行程：创建计划行程并验证列表与详情', async ({ page }) => {
  await openModule(page, '行程');
  // 行程的创建表单直接内嵌在列表页（.trip-create），无需打开弹窗
  const form = page.locator('.trip-create');
  await form.getByLabel('标题', { exact: true }).fill('五一京都行');
  await form.getByRole('button', { name: '创建行程' }).click();
  const item = page.locator('.trip-card', { hasText: '五一京都行' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: '查看' }).click();
  await expect(page.getByRole('heading', { name: '五一京都行' })).toBeVisible();
});

// ---------- 6. 人生文件夹：上传文件并验证 ----------
test('人生文件夹：上传一份文件并验证列表', async ({ page }) => {
  await openModule(page, '人生文件夹');
  await page.getByRole('button', { name: '上传文件' }).first().click();
  const dialog = page.getByRole('dialog', { name: '上传文件' });
  await dialog.getByPlaceholder('文件标题').fill('护照扫描件');
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'passport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
    ),
  });
  await dialog.locator('button').filter({ hasText: '上传文件' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.lf-doc', { hasText: '护照扫描件' })).toBeVisible();
});
