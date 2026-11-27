# @chpli2/ui — CHPLI 组件库

CHPLI 的设计系统与原子组件库。参考 ant-design v5 的视觉语言（值取自其默认 token），
用 CSS 自定义属性 + CSS Modules 实现，无运行时依赖（仅 peer react）。

## 架构：四层

1. **Design Tokens**（`tokens.css`）：颜色、圆角、阴影、动效的唯一事实来源。
   所有组件只写 `var(--chpli-*)`，**禁止硬编码颜色**。Host 与各 remote 的入口
   各 import 一次（`:root` 重复定义是幂等的），MF 场景下所有应用共享同一套变量。
2. **原子组件**（`components/`）：Button / Input / Textarea / Select / Chip / Modal / Empty。
   无业务含义、不碰 API、不内置文案（文案由调用方经 i18n 传入）。
3. **包工程**：workspace 包，消费方直接引 TS 源码（`main: src/index.ts`），
   不做独立构建/发布——这是内部组件库与 npm 开源库（需 rslib/rollup 构建 +
   文档站）的核心区别。
4. **样式投递**：组件样式是 CSS Modules（构建时类名哈希），保证 7 个 MF remote
   的 CSS 混在同一页面互不污染；token 是普通 CSS，经 `:root` 全局生效。

## 使用

```tsx
import { Button, Chip, Input, Modal, Select, Textarea, Empty } from '@chpli2/ui';
import '@chpli2/ui/tokens.css'; // 每个应用入口 import 一次
```

每个应用还需要 `src/css-modules.d.ts`（声明 `*.module.css` 模块，见各 app 现有文件）。

## 布局与模式层（P0/P1 试点）

除了原子控件，库还提供跨 app 复用的布局/模式组件。它们只负责结构与交互，
不碰 API、路由、认证或 i18n 文案。**项目规则：app 优先使用本库已有能力；不够用时先补库
（含测试），不要在各 app 复制实现。** Clean Code 优化记录见根目录
[`how-to-write-clean-code.md`](../how-to-write-clean-code.md)。

| 组件 | 用途 | 关键约束 |
|---|---|---|
| `Workspace` | Remote 内部工作区：toolbar + banner + sidebar + main + aside | 不渲染全局导航；高度 100% / `min-height:0`；`mainScroll` 决定谁滚动 |
| `SidePanel` | 右侧编辑面板；≤900px 抽屉，≤600px 可选底部弹层 | 桌面内联、移动端遮罩；Esc 关闭；标题/关闭按钮文案由调用方传入 |
| `Field` | label + control + hint/error | 控件放在 label 内以保留隐式关联；hint/error 在 label 外，避免污染 accessible name |
| `TagInput` | 标签/分类胶囊输入 | Enter/逗号添加、Backspace 删除、blur 提交；上限/超长通过 `onError` 交给 app 翻译 |
| `FilterRow` | 侧栏 checkbox 筛选行 | checkbox + label + 可选 count；语义色 class 由 app 传入 |
| `ResizeHandle` | 侧栏/抽屉宽度拖拽 | 指针拖拽 + 方向键；受控宽度；`role=separator` 与 aria 值 |
| `Tooltip` / `OverflowTooltip` | 截断标题/tag 的完整文本 | Portal 到 body，不被抽屉 overflow 裁剪；hover/focus；仅在文本溢出时显示 |
| `useStoredWidth` | 记住用户拖拽宽度 | 带 min/max clamp 的 localStorage hook；200ms 防抖，组件本身不写 storage |
| `Tabs` | pill / underline 两种页签 | 内置 `role=tablist`、`aria-selected`、方向键/Home/End；禁用项保留 `aria-disabled` |
| `Alert` / `Loading` | 统一错误/提示与加载态 | `Alert` 支持 action；危险/警告使用 `role=alert` |

```tsx
import { Workspace, SidePanel, Field, TagInput, Tabs, Alert } from '@chpli2/ui';
```

边界：`Workspace` 是 Remote 工作区，不是 Host 的全局 `AppShell`；业务卡片
（MemoChip、GoalCard、TripCard 等）继续留在 app。当前试点：Calendar（Memo）
与 Notes，用 `Workspace` / `SidePanel` / `Field` / `TagInput` / `Tabs` 替换了
各自的壳层和重复字段样式；原有 `cal-main`、`detail-panel`、`tag-editor` 等
e2e 选择器作为兼容钩子保留。

## 边界原则（组件库管什么、app 管什么）

- **库管"长得什么样"**：控件视觉、交互态（hover/focus/disabled）、弹层行为。
- **app 管"摆在哪里"**：布局、网格、业务卡片、响应式结构。
- 复合业务组件（MemoChip、GoalCard）留在 app，不进库；当出现第二个 app
  需要同模式时，再抽象进库（Modal 的 href 模式就是这么来的）。

## 如何新增一个组件

1. 先确认库内没有可复用的组件/模式；没有则新增 `tsx + module.css + test` 三件套，放到对应目录（`components/`、`layout/`、`form/`、`navigation/`、`feedback/`）
2. 样式只引用 token；类名用 camelCase（CSS Modules 约定）
3. 从 `index.ts` 导出类型 + 组件
4. 测试用 `@testing-library/react` + `fireEvent`（与仓库现有测试一致）

## 如何改主题

只动 `tokens.css`。例如换主色：改 `--chpli-primary` 及 hover/active/bg/border 四个派生值，
全仓 7 个应用同时生效——这就是 token 层的意义。

## 维护纪律

- token 改名要全仓迁移完再删旧名（过渡期用别名，见 git 历史中的 `--chpli-accent` 案例）
- 不要在组件里写 `var(--chpli-x, #兜底值)`：断链应该立刻暴露，兜底只会掩盖
