# CHPLI Roadmap

> 维护规则：每完成一个垂直切片更新本文档；已决策事项注明日期，未决策项标注「待定」，不写入未确认的设想。

## 当前状态（2026-11-12）

- **Notes N1 已交付（2026-11-12，任务书 `CHPLI笔记N1切片任务书.md`，M2' 首个模块）**：新 remote `apps/notes`（MF，端口 3003，Host 导航/认证/多语言复用）；笔记 CRUD + Markdown 安全渲染（react-markdown 默认转义原始 HTML）+ 标签/优先级（复用 Memo 模式：text[]、AND/OR 两级筛选、聚合端点）+ 防抖 1.5s 自动保存与 Cmd/Ctrl+S（乐观锁 409 冲突态）+ 三语文案。数据按用户隔离。测试：后端 174、shared 54、notes 6、host 19、e2e 29 项全绿。
- **M5 Portal 集成已交付（2026-11-12，任务书 `CHPLI日历备忘录M5切片任务书.md`）**：仓库内无 Portal 规格（已调研），按主流 postMessage 协议出 CHPLI 侧最小约定（`chpli:portal:ready/init/logout/login-request/navigate`，origin 白名单=同源+`PORTAL_ORIGINS`，**待与 Portal 方核对**）。统一登录：Portal 下发 JWT 经 fetchMe 校验后进入应用，Portal 模式不渲染本地登录卡（401/登出→「等待 Portal 登录」+ login-request）；返回首页/logout 经 postMessage 通知 Portal；独立运行（无父帧）行为与 M0–M4 完全一致（本地账号并存，不迁移令牌存储）。协议常量与类型守卫入 shared；同源模拟器（portal-simulator.html）支撑 e2e。
- **M4 即将到期与通知已交付（2026-11-12，任务书 `CHPLI日历备忘录M4切片任务书.md`）**：即将到期卡片（今天+未来 3 天+逾期未完成，点击直达实例）、月视图格内「今」角标与周/日视图今日列红点、浏览器通知（60s 轮询复用 memo 窗口查询、无后端变更；按实例会话级去重；Notification 不可用/被拒静默降级为纯 UI，default 权限由卡片按钮触发授权）。
- **M3 图片与响应式已交付（2026-11-12，任务书 `CHPLI日历备忘录M3切片任务书.md`）**：Memo 图片上传（MinIO 本地 docker-compose，文件体进对象存储、DB 只存元数据+存储键，magic bytes 嗅探，≤5MB，客户端 id 幂等，鉴权代理下载）；DetailPanel 响应式（≥901px 右栏 / ≤900px 抽屉 / ≤600px 底部弹层，遮罩+Esc 关闭）。MinIO 镜像实施修正：本机 docker 镜像源拒绝 `minio/minio`，改用 `bitnamilegacy/minio`（同一 MinIO 服务端）。
- **M2 标签与农历已交付（2026-11-12，任务书 `CHPLI日历备忘录M2切片任务书.md`）**：Memo 标签（`tags text[]`，≤10 个/每个 ≤32 字符）、两级筛选（`GET /api/memos?tags=` AND / `?priorities=` OR，两维之间 AND）、标签聚合端点 `GET /api/memos/tags`（筛选栏候选不受筛选影响）、筛选条件 localStorage 持久化；农历节气月视图采用 `lunar-javascript`（MIT，1900–2100，仅 zh-CN 渲染，范围外静默缺省）。
- **M1 日历备忘录核心已交付（2026-11-12，任务书 `CHPLI日历备忘录M1切片任务书.md`）**：Memo CRUD（纯日期、优先级、备注）、月/周/日三视图改造（周日起、周视图默认、视图偏好 localStorage 持久化）、9 种重复规则（前端 `expandMemoToRange` 展开）、双轨完成机制（非重复 `completed_at` / 重复 `memo_completions` 按实例）、DetailPanel。旧 Event UI（多日历/事件/提醒/节假日）随本切片退役，后端 events API 与 Travel 日历投影保留至后续切片退役。
- **产品方向调整（2026-11-11）**：Calendar 合并进「Portal 内的日历备忘录（Memo）」定位——以 Memo（纯日期、优先级、完成状态、标签、图片、重复规则）为核心对象，周日起周视图默认、中英（德保留）双语、农历节气、按实例完成、即将到期/通知/角标三重提醒。既有 Event 时刻/时区（F4）、多日历、节假日订阅能力将随 Memo 化逐步退役；F3（RRULE）任务书作废，重复规则按 Memo 规格（9 种 + 前端展开）实现。
- **M0 用户与认证已交付（2026-11-11）**：本地账号 + JWT，全模块按用户隔离（跨用户访问 404），默认用户 `chpli` 承载旧数据；Host 登录/注册三语界面，remote 统一携带令牌、401 自动回登录。测试：后端 116 项、e2e 16 项。
- **M0 增强已交付（2026-11-11 同日追加）**：登录标识支持用户名/邮箱/手机（单字段自动识别），凭据支持密码或 6 位验证码（`login_codes` 表持久化，10 分钟有效、60s 重发冷却、5 次试错作废，投递通道可插拔，当前 `log` 通道输出 devCode 供联调/e2e）；注册可绑定邮箱/手机（唯一约束，冲突 409）。测试：后端 127 项、e2e 17 项。
- 已交付：Travel 计划/回忆与日历同步投影（e2e 已改为 API 级断言）。
- 工程协作文件已就位：`AGENTS.md`、`PROJECT_INSTRUCTIONS.md`、`.kimi-code/agents/chpli-harness.md`。

## 里程碑

### M0：用户与认证（已交付 2026-11-11，任务书 `CHPLI用户与认证M0切片任务书.md`）

| 内容 | 状态 |
|---|---|
| users 表、注册/登录/me、JWT 认证、全模块数据按用户隔离、Host 登录界面 | 已交付 |
| 邮箱/手机绑定、标识符自动识别登录、验证码登录（login_codes + 可插拔投递） | 已交付（同日增强） |

### M1：Memo 核心（Calendar → Memo 化）

| 切片 | 内容 | 状态 |
|---|---|---|
| M1 | Memo CRUD + 三视图改造（周日起、周默认、偏好持久化）+ 9 种重复（前端展开 expandMemoToRange）+ 完成机制（非重复直接勾选，重复用 MemoCompletion 按日期实例）+ DetailPanel | 已交付（2026-11-12，任务书 `CHPLI日历备忘录M1切片任务书.md`） |
| M2 | 标签 + 两级筛选（标签 AND / 优先级 OR）+ 农历节气月视图 | 已交付（2026-11-12，任务书 `CHPLI日历备忘录M2切片任务书.md`） |
| M3 | 图片上传（MinIO 对象存储）+ DetailPanel 响应式（抽屉/底部弹层） | 已交付（2026-11-12，任务书 `CHPLI日历备忘录M3切片任务书.md`） |
| M4 | 即将到期卡片 + 格内紧急角标 + 浏览器通知（轮询） | 已交付（2026-11-12，任务书 `CHPLI日历备忘录M4切片任务书.md`） |
| M5 | Portal 集成：统一登录、postMessage（返回首页/登录/登出）、按用户隔离验收 | 已交付（2026-11-12，任务书 `CHPLI日历备忘录M5切片任务书.md`，协议待与 Portal 方核对） |

### M2'：Notes / Bookmarks / Growth & Career / Life Folder

| 模块 | 切片 | 内容 | 状态 |
|---|---|---|---|
| Notes | N1 | CRUD + Markdown 安全渲染 + 标签/优先级（复用 Memo 模式）+ 自动保存 + 两级筛选 | 已交付（2026-11-12，任务书 `CHPLI笔记N1切片任务书.md`） |
| Notes | N2 | 全文搜索 + 双链/反链（`[[id]]` 稳定 ID）+ 版本历史 + 附件（复用 M3 模式） | 待启动（切片划分待定） |
| Bookmarks | B1 | 分类/描述图片/卡片与列表/点击统计/30 天不活跃降级 | 待启动 |
| Growth & Career / Life Folder | — | 切片划分待定 | 待定 |

### Travel 模块（已交付部分保持）
- Plan/Memory 双形态、同级地图连线、日历同步投影已交付；随 M0 补用户隔离。

## 已决策事项

- 2026-11-12 **M1 核心决策（详见任务书 D1–D6）**：Memo 纯日期（无时区/时刻，日期键 UTC 算术）；重复由前端 `expandMemoToRange` 展开；完成双轨（非重复 `completed_at` / 重复 `memo_completions`，后者 `@@unique(memo_id, date)` 幂等）；旧 Event UI 随 M1 退役（后端 events API 与 Travel 投影保留）；视图偏好存 localStorage、周起始固定周日；9 种重复短月/缺序数日一律收拢。
- 2026-11-12 **Notes N1 核心决策（详见任务书 D1–D8）**：新 remote apps/notes（端口 3003，Host 导航/认证复用）；Markdown 渲染用 react-markdown 默认配置（原始 HTML 转义，不引 rehype-raw，根上规避 XSS）；自动保存=1.5s 防抖+Cmd/Ctrl+S+乐观锁冲突态；标签/优先级/幂等/隔离/筛选/聚合全部复用 Memo 成熟模式不重新设计；双链与版本历史不加列不建表（各自切片迁移引入）；无日历/时区语义。
- 2026-11-12 **M5 核心决策（详见任务书 D1–D7，协议待与 Portal 方核对）**：本地账号与 Portal 并存（落实 M0 H1）；令牌存储不迁移（M0 D4 评估结论）；父帧检测=parent!==window+500ms 握手超时回退独立模式；origin 白名单=同源+PORTAL_ORIGINS（rsbuild source.define 注入）；Portal 模式 401/登出→等待态+login-request，不渲染本地登录卡；登出双向消息两种入站均处理；navigate 仅 target:'home'；协议常量与类型守卫入 shared。
- 2026-11-12 **M4 核心决策（详见任务书 D1–D7）**：到期=实例日期≤今天且未完成，窗口=未来 3 天（+7 天逾期回看）；重复备忘按实例提醒（用户确认）、已通知判据 `memoId:date`、sessionStorage 会话去重；Notification 能力检测静默降级（用户确认），default 权限由用户手势授权；无后端变更（复用 memo 窗口查询）；轮询 60s；角标仅「今天到期」。
- 2026-11-12 **M3 核心决策（详见任务书 D1–D7）**：MinIO 本地 docker-compose（镜像实施修正为 bitnamilegacy/minio）；存储键 `memo-images/{userId}/{memoId}/{id}.{ext}`；下载走鉴权代理不做预签名；上传幂等（客户端 id）；删除先元数据后对象、对象失败不回滚；响应式断点 900/600px CSS media query；mime 白名单 4 类 + magic bytes 嗅探 + 单张 ≤5MB。
- 2026-11-12 **M2 核心决策（详见任务书 D1–D7）**：农历库选 `lunar-javascript`（MIT，1900–2100；排除 GPL 的 lunisolar），仅 zh-CN 渲染农历层、en/de 不渲染，范围外静默缺省；标签存 `text[]`（无独立标签表）；筛选语义=标签 AND/优先级 OR/两维 AND；标签候选走聚合端点不受筛选影响；筛选条件存 localStorage。
- 2026-11-12 **校验分层**：DTO 形态错误（class-validator）一律 400 `VALIDATION_ERROR`，服务层领域校验 422（与既有 travel/auth 行为一致）。
- 2026-11-11 **Memo 合并六项默认**：时刻/时区语义退役（Memo 纯日期）；节假日订阅随多日历退役；德语保留（中英德三语为规格超集）；用户隔离先做 user_id + mock 用户、Portal 登录留待 M5；图片用 MinIO 对象存储；旧 events 演示数据直接废弃不迁移。
- 2026-11-11 **认证方案**：本地账号（用户名 + 密码，bcrypt 哈希）+ JWT Bearer；全局 AuthGuard，`/api/auth/*` 与文档端点公开；每用户至少保留一个自建日历等既有规则升级为按用户生效。
- 2026-11-11 Calendar 交互对标 Apple Calendar 网页版（Memo 化前的历史决策，视图框架复用）。
- 2026-11-11 多日历 / 节假日订阅 / 到期提醒（F1+F2 决策）：随 Memo 化退役，实现见 F1+F2 任务书。
- 2026-11-11 F4 时间语义与 API 兼容决策：随 Memo 化退役，实现与测试保留在代码库中直至退役迁移。详见 F4 任务书 D1–D5。
- 2026-11-11 节假日内置数据（CN 2025 含调休；DE 16 州、CH 26 州 2024–2028）：随节假日订阅一并退役。

## 待决策事项

- Portal 平台接口规范——CHPLI 侧最小约定已出（M5 任务书，含消息格式与 origin 白名单），**待与 Portal 方核对**生产来源清单、login-request 后的登录呈现流程与 navigate 路由语义。
