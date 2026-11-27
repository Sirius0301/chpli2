# CHPLI Clean Code 实践手册

> 目的：把“能跑”提升为“可读、可测、可改、可回归”，并让 `@chpli2/ui` 成为前端视觉与交互的唯一复用入口。
> 适用范围：`apps/*` 前端、`packages/ui`、以及任何新增 UI 组件的 PR。
> 维护规则：每次基于 Clean Code 原则的优化，必须在第 9 节台账追加一行；没有台账的重构视为未完成。

---

## 1. 我们说的 Clean Code 是什么

不是“代码短”，也不是“多抽组件”。本项目的判断标准只有四个：

1. **可读**：新人能在 5 分钟内看懂组件职责、数据流和边界。
2. **可测**：行为能用组件测试/e2e 锁定，不依赖私有 CSS 类名。
3. **可改**：增加一个字段、换一个布局、改一个文案，只需要改一处。
4. **可回归**：重构不改变行为；有测试、有截图、有回滚路径。

三个自检问题：

- 这个知识（校验、布局、交互）在仓库里出现了几次？第二次出现就该评估抽取，第三次必须抽取。
- 改这个需求时，我是否只改了一个文件？如果不是，边界可能错了。
- 失败时，测试/日志/错误码能否直接告诉我在哪一层？如果不能，异常处理不合格。

边界先行：

| 层 | 负责 | 不负责 |
|---|---|---|
| `packages/ui` 原子/布局/模式 | 视觉、交互、布局槽位、无障碍语义、可复用 API | API 请求、路由、localStorage、固定业务文案 |
| app 业务组件 | 业务数据、i18n 文案、业务卡片（MemoChip/GoalCard/TripCard） | 重写 Button/Input/Modal/Tabs/Field/Workspace |
| 后端/shared | 领域规则、DTO、错误码 | 前端布局和展示细节 |

---

## 2. 硬规则（本项目）

1. **先查 `@chpli2/ui`，再写 app 组件。**
   Button、Input、Select、Textarea、Modal、Tabs、Field、TagInput、FilterRow、Workspace、SidePanel、Alert、Loading 已有能力，不得在 app 内复制实现或重写样式。
2. **库不足先补库。**
   新控件/新布局先在 `packages/ui` 提供可复用 API + `*.module.css` + 测试，再迁移调用方；禁止先在 app 里写一版“以后再说”。
3. **业务复合组件留在 app。**
   只有当第二个 app 需要同一模式时，才抽象进库；不要为了“统一”把 MemoChip、GoalCard 这类业务语义搬进库。
4. **组件受控、纯展示、无副作用。**
   组件不自行发请求、不读写 storage、不硬编码中文；文案、关闭标签、空态内容由调用方传入。
5. **命名表达意图。**
   组件 PascalCase；布尔值 `is/has/can/should`；事件 `onX`；纯函数动词开头；常量 `UPPER_SNAKE_CASE`；避免 `data`、`info`、`tmp` 这类空泛命名。
6. **函数和组件保持单一职责。**
   一个函数只做一件事；组件接近 200 行、JSX 嵌套超过 3 层、或同一段状态/事件逻辑出现第二次时，评估拆分。拆分不是目的，降低修改半径才是。
7. **类型即契约。**
   跨模块类型放 `packages/shared`；边界用 `unknown` 收敛，不用 `any`；联合类型用判别字段；可空/可选要显式；导出函数写清返回类型。
8. **错误必须显式。**
   不吞异常；UI 用 `Alert` / `Field error`；保留稳定 `errorCode`；错误文案由 app 翻译，库不写死。
9. **样式只用 token。**
   不硬编码颜色/阴影/圆角；组件样式用 CSS Modules；app 全局 CSS 不得用通用类名（`.loading`、`.field`）污染其他 MF 应用；不要写 `var(--chpli-x, #兜底值)`。
10. **无障碍是组件 API 的一部分。**
    角色、`aria-*`、键盘行为、焦点管理随组件一起交付；图标按钮必须有 `label`；Tab 必须有 `role=tablist/tab` 与 `aria-selected`。
11. **测试行为，不测实现。**
    用 role/text/testid 定位；不依赖私有 class；重构必须保持测试绿；修 bug 先补能复现的失败用例。
12. **每次优化写台账。**
    见第 9 节；纯格式化、纯改名不算 Clean Code 优化，除非它消除了真实歧义。

---

## 3. 组件设计：什么时候抽，什么时候不抽

### 该抽的信号

- 同一段 JSX/逻辑在第二个 app 出现（如右侧面板、标签输入、Tab）。
- 同一套 CSS 布局在第二个文件复制（如 `display:contents + backdrop + @media 900`）。
- 一个组件同时承担“布局 + 表单 + 请求 + 错误处理”多种职责。
- JSX 中出现三层以上嵌套三元表达式，或一个 prop 里有 30 行 JSX。
- 组件对外暴露的 props 超过 10 个且多数只是透传（先检查是否该拆 slot）。

### 不该抽的信号

- 只有一处使用、且没有明确的第二次使用场景（业务卡片、一次性页面区块）。
- 抽象后需要大量布尔 props/`renderX` 才能适配，说明边界还没稳定。
- 为了“统一”而抹掉业务差异（MemoChip 的优先级、GoalCard 的进度、TripCard 的类型徽标）。

### 已确立的基础设施（直接复用，不受“三次才抽象”限制）

`Workspace`、`SidePanel`、`Field`、`TagInput`、`FilterRow`、`Tabs`、`Modal`、`Alert`、`Loading`、`Button`。

### API 设计约定

- 布局用 **slots**（`toolbar/sidebar/aside/children`），不用大量布尔开关。
- 表单用 **受控值 + onChange**，不在组件内部保存业务状态。
- 展示组件用 **props 传文案**，不内置 i18n key。
- 需要逃生舱时提供 `className`，但必须在 PR 说明原因；不要用全局选择器覆盖库内部。
- 兼容旧测试的类名（如 `cal-main`、`detail-panel`）是**临时钩子**，新测试优先用 `data-testid`/role。

---

## 4. 函数、状态与副作用

- 纯逻辑抽成纯函数（`toggle`、`formatX`、`validateX`），放在组件外，便于单测。
- 事件处理器命名 `handleSubmit` / `handleDelete`，对外回调 `onSubmit` / `onDelete`。
- 能派生就不要同步：`const filtered = useMemo(...)` 优于 `useEffect(() => setFiltered(...))`。
- `useEffect` 只用于外部同步（订阅、定时器、DOM 副作用）；必须写 cleanup；异步请求必须防竞态（`cancelled` 标志）。
- 不要为了“性能”给所有函数套 `useCallback`；只在依赖稳定性能/引用相等时使用。
- 复杂条件用早返回；避免嵌套 if 和嵌套三元。
- 一个函数超过约 40 行或参数超过 4 个，评估拆分/参数对象。

---

## 5. 类型与接口

- 跨模块共享类型放 `packages/shared`；不要从 app 的 `App.tsx` 导出领域类型给别的组件（会造成组件→App 的反向依赖）。
- 边界数据用 `unknown` + 类型守卫；不要 `as any` 绕过。
- 用判别联合表达状态：
  ```ts
  type PanelState = { kind: 'create'; date: string } | { kind: 'edit'; instance: Memo } | null;
  ```
- 可选与可空分开：`field?: string`（缺省）vs `field: string | null`（显式无值）。
- 只读输入用 `readonly T[]`；不要修改传入数组。
- 导出组件的 props 接口必须导出，调用方可组合。

---

## 6. 样式、设计与 i18n

- 只使用 `var(--chpli-*)`；新增语义色先加 token（如 `--chpli-success-bg`）。
- 组件样式用 CSS Modules；app 级全局 CSS 只保留业务类名，通用类名收敛到库。
- 断点统一向 600 / 900 / 1200 靠拢；新组件不得引入 620/720/760 等新断点。
- MF 场景下 CSS 会共存：不要写 `.loading` 这类全局通用类；需要时用 app 根作用域或 CSS Modules。
- 时间/日期/时区分为三件事：时刻、day key、展示格式；不要把 UTC 截取当“今天”。
- 库组件不内置中文/英文文案；所有用户可见文本由调用方传入。

---

## 7. 无障碍与交互

- 图标按钮必须有 `aria-label`；可用 `IconButton`（后续统一）。
- Tab 必须 `role=tablist` + `role=tab` + `aria-selected`；禁用时同时设置 `disabled` 与 `aria-disabled`（本项目 e2e 已踩过一次）。
- Dialog 必须有可访问名称（`aria-labelledby`）；`Esc` 关闭；`alertdialog` 用于打断式确认。
- 表单错误用 `role=alert`，并让错误文本与控件可关联；Field 的 label 必须保留隐式关联。
- 侧栏/面板在移动端进入 overlay 时，后续应补焦点陷阱与 body 滚动锁；未实现前必须在文档/PR 标注。

---

## 8. 测试与验证

- 组件测试：行为、状态、错误、键盘；用 role/label/testid，不查私有 class。
- 页面测试：真实交互、空态、错误态、刷新持久化、窄屏、三语言。
- 重构门槛：`pnpm typecheck` + 受影响包测试 + 相关 e2e；共享 UI 变更追加 `packages/ui` 测试。
- 涉及数据库的 `pnpm verify` 会执行 `resetDatabase()`；**不得在有真实数据的开发库上直接跑**，先切独立测试库或备份。
- 未运行的检查不得在交付说明中声称通过。

---

## 9. Clean Code 优化台账

> 追加规则：日期、范围、发现的问题、优化、验证、对应原则。每次 PR 至少一行；没有台账的重构不合并。

| 日期 | 范围 | 发现的问题 | 优化 | 验证 | 对应原则 |
|---|---|---|---|---|---|
| 2026-11-27 | `packages/ui` + Memo/Notes | 每个 app 各写一套工作区壳/右侧面板；`display:contents + backdrop + @media 900` 复制多次 | 新增 `Workspace` / `SidePanel`，迁移 Calendar 与 Notes；兼容类名保留 | `pnpm typecheck`；UI 27 / Calendar 27 / Notes 31；Memo+Notes e2e 39；Travel+user-journey 10 | DRY、SRP、单一布局契约 |
| 2026-11-27 | Memo/Notes 表单 | `label + span + error` 在 7 处重复；标签输入逻辑在 2 处重复 | 新增 `Field` / `TagInput`，Memo DetailPanel、Notes PublishForm 迁移 | UI 27；Calendar 27；Notes 31；e2e 39 | DRY、封装变化点 |
| 2026-11-27 | Memo/Notes 交互 | 视图/编辑页签手写 5 套 `role=tablist`；Modal 缺 `alertdialog`/本地化关闭标签 | 新增 `Tabs`；`Modal` 增加 `role`、`closeLabel`、`aria-labelledby`；修复 `aria-disabled` | e2e 39（含 rich mode 回归）；UI 27 | DRY、可访问性、显式契约 |
| 2026-11-27 | Notes 筛选 + Calendar 优先级 | 4 组 checkbox 行重复；`NoteFiltersState` 从 `App.tsx` 导出，组件反向依赖 App | 新增 `FilterRow`（Notes 四组 + Calendar 优先级）；`NoteFiltersState` 移到 `NoteFilters`；新增 `NotesSidebar` 收敛侧栏 | Notes 31；Calendar 27；e2e 39；typecheck | DRY、SRP、依赖方向 |
| 2026-11-27 | Calendar | `Workspace aside` 中三层三元表达式可读性差 | 提取 `detailPanel` 变量后再传入 slot | Calendar 27；e2e 39 | KISS、可读性 |
| 2026-11-27 | UI tokens | `Chip` 的 success/warning 颜色硬编码 | 新增 success/warning bg/border token，Chip 改用 token | UI 27 | 单一事实来源 |
| 2026-11-27 | `packages/ui` | `Modal`/`Chip` 的可访问标签有英文兜底，违反“库不硬编码文案” | `Modal.closeLabel` / `Chip.removeLabel` 改为必填；所有调用方传 i18n 文案 | UI 27；Travel typecheck；Travel+user-journey 10 | 显式契约、i18n、可访问性 |
| 2026-11-27 | Calendar DetailPanel | 标签校验与表单校验共用 `error`，移除标签会清掉无关表单错误 | 拆分 `tagError` 与表单 `error`；`Field error` 局部展示 | Calendar 27；Memo+Notes e2e 39 | SRP、状态内聚 |
| 2026-11-27 | Memo/Notes 宽度 | 侧栏/抽屉固定宽度，无持久化；Notes 抽屉内容易被挤压 | 新增 `ResizeHandle` + `useStoredWidth`；`Workspace`/`SidePanel` 受控宽度；Notes 抽屉改为 contained `SidePanel` 并支持拖拽 | verify 441；e2e 42；桌面/窄屏截图 | SRP、DRY、可用性 |
| 2026-11-27 | 截断标题/tag | 多处 `ellipsis` 丢失完整文本 | 新增 `Tooltip` + `OverflowTooltip`（portal 防裁剪；仅溢出时显示）；Notes 卡片、Memo due/tag、Host 首页笔记标题接入 | e2e tooltip 用例（42 全套） | DRY、可访问性 |
| 2026-11-27 | Memo 日视图 | 日视图右侧空白，Notes 只能跨模块手动切换 | 新增 `DayNotes`；Notes API 增加 createdAt 窗口查询；点击经 sessionStorage 信箱 + `chpli2-navigate` 打开编辑视图 | API 244；e2e day-notes 用例 42 全套 | 模块边界、可追溯、复用 |
| 2026-11-27 | Notes 抽屉内容 | 自定义 absolute 抽屉 CSS；版本/图片/反链布局在窄宽度下易溢出 | 迁移到 contained `SidePanel`；版本行换行、图片网格自适应、反链文本可断行 | Notes 31；notes-n2 e2e；42 全套 | DRY、SRP、可读性 |
| 2026-11-27 | P0 兼容 | e2e 依赖 `cal-main`、`detail-panel`、`tag-editor` 等私有类名，直接改类名会破坏 239 处定位 | 保留兼容类名；新增 `calendar-app`/`notes-app`/`workspace-main`/`side-panel` 稳定钩子 | Memo+Notes e2e 39；Travel+user-journey 10 | 可测试性、渐进迁移 |

验证口径：`pnpm verify` 已在独立 `chpli2_test` 库通过（441 tests，未触碰开发库）；另运行 `pnpm typecheck`、`packages/ui` 29、`apps/calendar` 28、`apps/notes` 31、Memo+Notes e2e 42、Travel+user-journey e2e 10。未运行全量 e2e 的其余模块（Bookmarks/Growth/LifeFolder 等），本次改动未直接触及它们。具体数字以命令输出为准。

---

## 10. 例外与待办

- **业务卡片不迁移**：MemoChip、GoalCard、TripCard、BookmarkItem 等保留在 app；出现第二个 app 同模式时再抽。
- **一次性布局不抽象**：只出现一次、且没有明确复用场景的页面区块，不强行组件化。
- **兼容类名是临时债**：`cal-main`、`detail-panel`、`tag-editor` 等保留到对应 e2e 迁移到 role/testid 后再删。
- **未完成的无障碍项**：Modal/SidePanel 的焦点陷阱、body 滚动锁、Dialog 焦点归还；Notes 的阅读视图/抽屉仍在 app 内，下一步用 `SidePanel` 的 contained 变体或独立 `ReadingOverlay` 迁移。
- **未迁移的 app**：Host、Travel、Bookmarks、Growth、LifeFolder 仍使用各自布局，按垂直切片逐个迁移；迁移前先补库能力，不要在 app 里临时复制。
- **有意的例外**：`DetailPanel` 仍有约 350 行、12 个表单状态；它共享校验、dirty snapshot 和 imperative submit handle，拆分会增加跨组件状态传递。保留单组件并在下次引入表单 reducer 时再拆分，属于“评估后暂不拆”，不是遗漏。

---

## 11. 新优化台账模板

```markdown
| YYYY-MM-DD | 范围 | 发现的问题（具体到重复/依赖/复杂度） | 优化（新增/抽取/改名/边界） | 实际运行过的验证 | 对应原则（SRP/DRY/KISS/可读性/可测试性等） |
```
