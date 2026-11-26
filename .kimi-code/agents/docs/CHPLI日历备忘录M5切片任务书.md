# CHPLI 日历备忘录（M5）切片任务书

> 范围：Portal 集成——统一登录（SSO 令牌经 postMessage 下发）、postMessage 返回首页/请求登录/登出、按用户隔离在 Portal 模式下的验收。
> 不在本切片：Portal 方自身的实现、跨域部署配置（生产白名单由环境变量注入）、刷新令牌轮换、Portal 语言/主题同步。
> 依据：ROADMAP M5（最后一项 Memo 化切片）；M0 D4/H1（本地账号与 Portal 并存，令牌存 localStorage，M5 评估迁移——结论 D2 不迁移）。
> 前置：M0–M4 已交付。**仓库中无 Portal 平台规格**（已调研 apps/host、README、ROADMAP、PROJECT_INSTRUCTIONS、Developer-Tutorial、MF 配置，仅有 M0 任务书假设），本切片按主流 postMessage 协议设计最小约定，**全部协议决策标注「待与 Portal 方核对」**。

---

## 一、切片目标

CHPLI Host 作为 Portal 子应用运行于 Portal 的 iframe 中时：Portal 通过 postMessage 下发会话（统一登录，CHPLI 不再渲染自有登录卡）；CHPLI 可经 postMessage 请求 Portal 返回首页、请求 Portal 登录、通知 Portal 登出；无 Portal 父页时（独立运行）行为与 M0–M4 完全一致（本地账号并存，M0 H1）。用户在 Portal 模式下仍严格按用户隔离（验收项）。

## 二、postMessage 协议（最小约定，待与 Portal 方核对）

所有消息为 JSON 对象，含 `source: 'chpli2'` 与 `type` 字段；仅 `window.parent` 为合法来源时可发送；入站消息做 **origin 白名单校验**（D3）。

| 方向 | type | 载荷 | 时机 |
|---|---|---|---|
| CHPLI → Portal | `chpli:portal:ready` | `{}` | Host 启动且检测到父帧后握手（500ms 超时未应答 → 视为独立运行） |
| Portal → CHPLI | `chpli:portal:init` | `{ token: string, user: { id, username } }` | 握手应答 / Portal 登录态变化（下发或更新会话） |
| Portal → CHPLI | `chpli:portal:logout` | `{}` | Portal 会话终止 |
| CHPLI → Portal | `chpli:portal:login-request` | `{}` | CHPLI 在 Portal 模式下令牌缺失/失效，请求 Portal 呈现其登录界面 |
| CHPLI → Portal | `chpli:portal:logout` | `{}` | 用户在 CHPLI 点击登出 |
| CHPLI → Portal | `chpli:portal:navigate` | `{ target: 'home' }` | 返回 Portal 首页 |

## 三、核心决策

记录（2026-11-12，协议待与 Portal 方核对）：

- **D1 并存模式（落实 M0 H1）**：Portal 会话与本地账号并存。独立运行 = 现状（本地登录卡）；Portal 模式 = 会话完全由 Portal 下发，CHPLI 不渲染登录卡。`chpli:portal:init` 的令牌写入与本地登录相同的存储键（`chpli2-token`/`chpli2-user`），远端请求封装与 401 广播机制不变——**令牌存储不迁移**（M0 D4 评估结论，改动面与收益不成比例）。
- **D2 模式检测**：`window.parent !== window` 即发送 `ready` 握手；500ms 无 `init`/`logout` 应答 → 独立模式。Portal 主动 `logout` 消息也视为 Portal 模式（会话由 Portal 管理）。
- **D3 origin 白名单**：入站消息仅接受 `event.origin === location.origin`（同源，dev/e2e）或包含在 `PORTAL_ORIGINS` 环境变量（逗号分隔，经 rsbuild `define` 注入）中的跨源 Portal。其他来源一律忽略。**待与 Portal 方核对**生产来源清单。
- **D4 Portal 模式下的认证 UX**：init 收到令牌后先正常 `fetchMe` 校验（不信任父页盲写）；校验通过进入应用；401 → 不渲染本地登录卡，渲染「等待 Portal 登录」占位并发送 `login-request`，直至收到新的 `init`。Portal 收到 `login-request` 后应呈现其登录 UI 并在完成后重新 `init`（**待与 Portal 方核对**）。
- **D5 登出语义**：Portal 模式点击登出 → 清除本地令牌 + 发送 `chpli:portal:logout`；CHPLI 自身不销毁 Portal 会话的权威性——Portal 可选择终止会话并回发 `logout`，或下发新 `init`（**待与 Portal 方核对**终态流程；CHPLI 两种入站都处理）。
- **D6 返回首页**：Portal 模式顶部显示「返回首页」按钮（仅 Portal 模式渲染，独立模式无此入口），点击发送 `chpli:portal:navigate {target:'home'}`。**待与 Portal 方核对** Portal 侧路由语义。
- **D7 协议常量化**：消息 type 与载荷类型入 `@chpli2/shared`（`portal.ts`），供 Host 与 e2e 模拟器共用；入站消息经类型守卫校验，非法载荷忽略。

## 四、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E71 | 父帧来源不在白名单 | 忽略消息，不进入 Portal 模式（防恶意父页注入会话） |
| E72 | `init` 载荷非法（缺 token/user 字段） | 类型守卫拒绝，保持当前状态 |
| E73 | Portal 模式下令牌校验 401 | 「等待 Portal 登录」占位 + 发送 `login-request`，不渲染本地登录卡 |
| E74 | 握手超时（父帧不应答） | 回退独立模式（本地登录卡），功能完整 |
| E75 | Portal 下发 `logout` | 清除本地会话 → 「等待 Portal 登录」占位 |
| E76 | 独立运行 | 与 M0–M4 完全一致（无返回首页按钮、无握手副作用） |

## 五、验收标准

- A64 模拟 Portal 握手：收到 `ready` 后下发 init（注册用户令牌）→ CHPLI 进入应用（不显示登录卡）
- A65 Portal 模式点击「返回首页」→ 父页收到 `chpli:portal:navigate {target:'home'}`
- A66 Portal 模式下 401 → 「等待 Portal 登录」+ 父页收到 `login-request`；父页重新 init 后恢复
- A67 Portal 模式点击登出 → 父页收到 `chpli:portal:logout`，CHPLI 进入等待态
- A68 按用户隔离：Portal 下发用户 A 会话只见 A 的 Memo；换成用户 B 会话不可见（404/列表为空）
- A69 独立运行（无父帧）回归：登录/登出/返回首页按钮不存在，全部既有 e2e 通过
- A32–A63 回归通过

## 六、测试覆盖要求

- **单元测试**：消息类型守卫（合法/非法载荷）、origin 白名单判定、握手超时回退。
- **组件测试**：Portal 模式渲染矩阵（init 进入 / 401 等待态 / logout 等待态）、独立模式无 Portal UI。
- **端到端测试**：`apps/host/public/portal-simulator.html`（同源测试台架，模拟 Portal 父页）驱动全链路：握手→init→应用内操作→navigate/logout/login-request→重 init；跨用户隔离在 Portal 模式抽查一条。
- **协议核对**：以上消息格式为单侧约定，集成前需与 Portal 方核对（ROADMAP 待决策项保持开启）。

## 七、假设（待确认）

- **H18** Portal 以 iframe 嵌入 CHPLI（同源或 PORTAL_ORIGINS 白名单跨源）；其他嵌入方式（如微前端模块级集成）不适用本协议。
- **H19** Portal 会话令牌即 CHPLI API 的 JWT（同一签发方）；若 Portal 用独立令牌体系需加换取层（另议）。
- **H20** e2e 模拟器为同源页面（rsbuild public 目录），不代表真实 Portal 实现。

## 八、完成定义（DoD）

E71–E76 有对应测试；A64–A69 与既有回归通过；shared 协议常量与类型守卫入仓；`ROADMAP.md` 更新 M5 状态（Portal 接口规范待决策项标注「CHPLI 侧最小约定已出，待与 Portal 方核对」）。
