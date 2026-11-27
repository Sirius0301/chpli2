# E2E 选择器规范

> 目标：测试描述用户行为，而不是绑定实现类名。新增/修改的 spec 必须遵守本文；存量 spec 通过 `e2e/legacy-class-selectors.json` 基线逐步迁移。

## 优先级

1. `getByRole`（含 `name`）——按钮、tab、dialog、checkbox、textbox 等语义元素。
2. `getByLabel` / `getByPlaceholder` / `getByText`——表单与可见文案。
3. `getByTestId`——没有稳定语义、但需要稳定定位的容器/截断文本/tooltip trigger。
4. **禁止新增** `locator('.some-class')` 这类私有 CSS 类定位。

## `data-testid` 命名

格式：`<module>-<element>[-<qualifier>]`，全小写 kebab-case，语义稳定，不包含实现细节。

```text
memo-sidebar
notes-sidebar
side-panel-panel
day-notes
day-note-item
calendar-toolbar-title
```

规则：

- 不使用会随样式重构变化的类名、DOM 层级或组件内部名称。
- 同一 testid 在一个页面内应唯一；列表项用容器 testid + `getByRole`，或 `data-*` 业务键（如 `data-tag`）。
- 动态 id/日期不要直接拼进 testid；用容器 + `hasText` / `filter`。
- 测试选择器变化必须在同一切片更新对应测试；不允许为了让旧测试通过而恢复脆弱类名。

## 迁移策略

- `e2e/legacy-class-selectors.json` 记录每个 spec 的存量私有 class 定位数；`pnpm check:e2e-selectors` 在数量增加时失败。
- **迁移截止：2027-01-31**。每次触碰一个 spec 至少把一处 class 定位换成 role/label/testid；只能单向减少基线。
- 紧急情况下新增 class 定位必须在 PR/交付说明写明原因、负责人和移除计划；不得直接 `--update` 抬高基线。
- 更新基线只允许在存量减少后执行：`node scripts/check-e2e-selectors.mjs --update`。

## 常用替换

| 旧写法 | 新写法 |
|---|---|
| `page.locator('.detail-panel')` | `page.getByTestId('side-panel-panel')` 或 `getByRole('complementary', { name })` |
| `page.locator('.memo-sidebar')` | `page.getByTestId('memo-sidebar')` |
| `page.locator('.notes-side')` | `page.getByTestId('notes-sidebar')` |
| `page.locator('.note-editor__drawer')` | `page.getByTestId('side-panel-panel')` |
| `page.locator('.cal-toolbar__title')` | `page.getByTestId('calendar-toolbar-title')` |
| `page.locator('.day-notes__item', { hasText })` | `rail.getByRole('button', { name: /.../ })` |

## 验证

```bash
pnpm check:e2e-selectors   # 基线守卫；数量不得增加
pnpm test:e2e:test         # 隔离测试库运行 e2e（需先停止占用端口的 dev server）
```
