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

## 边界原则（组件库管什么、app 管什么）

- **库管"长得什么样"**：控件视觉、交互态（hover/focus/disabled）、弹层行为。
- **app 管"摆在哪里"**：布局、网格、业务卡片、响应式结构。
- 复合业务组件（MemoChip、GoalCard）留在 app，不进库；当出现第二个 app
  需要同模式时，再抽象进库（Modal 的 href 模式就是这么来的）。

## 如何新增一个组件

1. `src/components/NewThing.tsx` + `NewThing.module.css` + `NewThing.test.tsx`（三件一套）
2. 样式只引用 token；类名用 camelCase（CSS Modules 约定）
3. 从 `index.ts` 导出类型 + 组件
4. 测试用 `@testing-library/react` + `fireEvent`（与仓库现有测试一致）

## 如何改主题

只动 `tokens.css`。例如换主色：改 `--chpli-primary` 及 hover/active/bg/border 四个派生值，
全仓 7 个应用同时生效——这就是 token 层的意义。

## 维护纪律

- token 改名要全仓迁移完再删旧名（过渡期用别名，见 git 历史中的 `--chpli-accent` 案例）
- 不要在组件里写 `var(--chpli-x, #兜底值)`：断链应该立刻暴露，兜底只会掩盖
