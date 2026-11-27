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
   一个函数只做一件事；组件超过 250 行、JSX 嵌套超过 3 层、或同一段状态/事件逻辑出现第二次时，评估拆分（例外写入台账）。拆分不是目的，降低修改半径才是。
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
- 涉及数据库的 `pnpm verify:test` 会执行 `resetDatabase()`；使用独立 `chpli2_test` 库；**不得在有真实数据的开发库上直接跑**。e2e 用 `pnpm test:e2e:test`。
- 未运行的检查不得在交付说明中声称通过。

---

## 9. Clean Code 优化台账

> 记录规则：**一个切片/PR 一条**，只记结构性优化（去重、抽组件、依赖方向、状态边界、命名体系），不记纯改名/格式化/一次性文案。大范围重构另写决策记录到 `.kimi-code/agents/docs/`，这里只留摘要与验证。
> 没有台账的结构性重构不合并；旧条目不再按文件拆成多行。

| 日期 | 范围 | 发现的问题 | 优化 | 验证 | 对应原则 |
|---|---|---|---|---|---|
| 2026-11-27 | UI 基座 + Memo/Notes 首次迁移 | 每个 app 各写工作区壳、右侧面板、字段、标签输入、Tabs、筛选行；`label + span + error` 重复 7 处；`NoteFiltersState` 反向依赖 `App.tsx` | 新增/接入 `Workspace`、`SidePanel`、`Field`、`TagInput`、`FilterRow`、`Tabs`、`Alert`、`Loading`；`Modal`/`Chip` 可访问标签必填；`Modal` 补焦点陷阱、body 滚动锁和焦点归还；新增 `NotesSidebar`，迁移 `NoteFilters` 类型；Calendar 提取 `detailPanel` 变量 | `pnpm verify:test` 442；UI 30；Calendar 28；Notes 31；Memo+Notes e2e 43；Travel+user-journey 10 | DRY、SRP、依赖方向、显式契约 |
| 2026-11-27 | 布局、抽屉与阅读体验 | 侧栏/抽屉固定宽度无持久化；Notes 抽屉自定义 absolute 样式且窄宽度溢出；阅读层无 portal/焦点管理/滚动锁；截断标题/tag 无法查看全文；Memo 窄屏工具栏标题挤成多行 | 新增 `ResizeHandle` + `useStoredWidth`（受控宽度 + 防抖持久化）；Notes 抽屉改 contained `SidePanel`（版本换行/图片自适应/反链断行）；抽取 `NoteReading`（portal、焦点陷阱、滚动锁、焦点归还）；新增 `Tooltip`/`OverflowTooltip`（portal、仅溢出显示、自动翻转）；Memo 工具栏 nav+tabs 一行、标题整行 | e2e 43（含 390px 工具栏、tooltip、拖拽持久化、阅读视图）；桌面/窄屏截图 | SRP、可访问性、响应式、可读性 |
| 2026-11-27 | Memo 日视图 Notes 模块 | 日视图右侧空白；Notes 只能手动切换；无按创建日的查询 | 新增 `DayNotes` 卡片列表；Notes API 增加 `createdFrom/createdTo`（左闭右开）；点击经 sessionStorage 信箱 + `chpli2-navigate` 打开编辑视图，不 import 另一 Remote | API 244；e2e `memo-day-notes` 43 全套；`createdAt` 窗口集成测试 | 模块边界、可追溯、幂等入口 |
| 2026-11-27 | P0 测试稳定性 | e2e 依赖 `cal-main`、`detail-panel`、`tag-editor` 等私有类名；新 spec 也复制 class 定位 | 保留兼容类名；补 `calendar-app`/`notes-app`/`workspace-main`/`side-panel`/`side-panel-panel` 等稳定钩子；新增选择器基线与 `check:e2e-selectors` 守卫，新 spec 改为 role/testid | 选择器守卫 246 存量且不增加；e2e 43 | 可测试性、渐进迁移 |
| 2026-11-27 | 验证基础设施 | `resetDatabase()` 与开发库冲突；e2e 私有 class 无门禁；i18n 只靠人工 | 新增 `verify:test` / `test:e2e:test`（隔离库）；selector 基线与 `check:e2e-selectors`；`check:i18n`；GitHub Actions CI | `pnpm verify:test` 442；selector 246 不增加；i18n parity OK | 可测试性、反馈闭环 |

验证口径：`pnpm verify:test` 已在独立 `chpli2_test` 库通过（442 tests，未触碰开发库）；另运行 `pnpm typecheck`、`packages/ui` 30、`apps/calendar` 28、`apps/notes` 31、Memo+Notes e2e 43、Travel+user-journey e2e 10。未运行全量 e2e 的其余模块（Bookmarks/Growth/LifeFolder 等），本次改动未直接触及它们。具体数字以命令输出为准。

---

## 10. 例外与待办

- **业务卡片不迁移**：MemoChip、GoalCard、TripCard、BookmarkItem 等保留在 app；出现第二个 app 同模式时再抽。
- **一次性布局不抽象**：只出现一次、且没有明确复用场景的页面区块，不强行组件化。
- **兼容类名是临时债**：`cal-main`、`detail-panel`、`tag-editor` 等保留到对应 e2e 迁移到 role/testid 后再删。
- **未完成的无障碍项**：`SidePanel` 在移动端 overlay 时仍缺焦点陷阱/滚动锁；Modal 已补齐。Notes 阅读视图已抽为 `NoteReading`，抽屉已用 `SidePanel` contained 模式。
- **Lint 基线未启用**：仓库原本没有 ESLint/Biome 配置，直接全量启用会在冻结 app 上产生大量无关改动。当前先用 selector/i18n/typecheck/build/CI 作为门禁；下一步单独解冻一个 lint 切片，先只对 `packages/ui` 与 Memo/Notes 启用。
- **未迁移的 app**：Host、Travel、Bookmarks、Growth、LifeFolder 仍使用各自布局，按垂直切片逐个迁移；迁移前先补库能力，不要在 app 里临时复制。
- **有意的例外**：`DetailPanel` 仍有约 350 行、12 个表单状态；它共享校验、dirty snapshot 和 imperative submit handle，拆分会增加跨组件状态传递。保留单组件并在下次引入表单 reducer 时再拆分，属于“评估后暂不拆”，不是遗漏。

---

## 11. 新优化台账模板

```markdown
| YYYY-MM-DD | 范围 | 发现的问题（具体到重复/依赖/复杂度） | 优化（新增/抽取/改名/边界） | 实际运行过的验证 | 对应原则（SRP/DRY/KISS/可读性/可测试性等） |
```
