# CHPLI Roadmap

> 维护规则：每完成一个垂直切片更新本文档；已决策事项注明日期，未决策项标注「待定」，不写入未确认的设想。

## 当前状态（2026-11-26）

- **Notes N3（博客园风格编辑器）已交付（2026-11-25/26，需求直接迭代，无任务书）**：编辑器重构——提示行（编辑器下拉 + 自动备份状态标签）、编辑/预览 Tab（蓝色下划线、默认单栏）、14+ 紧凑图标工具栏（加粗/链接/代码/表格/列表/引用/任务/TeX/目录/保存/阅读/全屏/传图/分屏）、细边框编辑画布与右下角轻量开关（数学公式/自动换行/自动补全）；**可选左右分屏**（可拖分割条 + 同步滚动）；图片拖拽/粘贴上传自动插入 `note-image://` 语法（渲染期经鉴权 API 解析，刷新不失效）；**防抖自动备份 + localStorage 兜底**（未保存恢复）；**发布表单真实持久化**（分类/摘要/标签胶囊/高级面板：评论开关、置顶、密码、首页展示、优先级 + 保存草稿/定时发布/发布随笔）；**发布生命周期** draft/published/scheduled（进程内 30s 清扫到点自动翻转，幂等可补扫）；**访问密码 scrypt+盐哈希**（API 只回传 `hasAccessPassword`）；**阅读视图**（沉浸全屏渲染 + 分类/状态/发布时间元信息）；列表置顶排序与状态角标；TeX 数学公式（KaTeX）。保留 N2 全部能力（双链/版本/反链/附件，移至抽屉）。测试：后端 240、notes 26、e2e 60 项全绿；新增 `e2e/user-journey.spec.ts`（用户视角六模块 UI 创建数据并验证）与 `scripts/create-test-data.mjs` 修订（custom 重复回归样例、trips 计数修正）。
- **时区修正（2026-11-26）**：日历到期标签（Sidebar dueLabel）与成长回顾默认日期（reviews todayKey）由 UTC 日改本地日——东八区每天 00:00–08:00 窗口内「今天到期」曾错显「还有 1 天」、零点刚过创建的回顾被记成昨天。回归中发现并修复（e2e/集成测试在午夜窗口暴露）。
- **Bug 修复轮已交付（2026-11-24，见 `CHPLI-Bug修复.md`）**：首页 Netflix 风 hero + 核心价值观与模块卡片；Host 高度收敛 100vh 各模块内部滚动；月视图整格单击建备忘 + 灰色提示；编辑备忘未保存切换弹「保存并打开/不保存/取消」+ toast；重复规则 `custom`（勾选星期）与预选项清理；标签侧边栏重命名/删除与 header 总数。测试：e2e `memo-bugfix.spec.ts` 5 项。
- **Life Folder L1 已交付（2026-11-14，任务书 `CHPLI人生文件L1切片任务书.md`，M2' 第五个/最后一个模块）**：新 remote `apps/lifefolder`（端口 3006）；文件分类体系（七类内置种子 + 自定义分类，树深 ≤2，非空分类删除拦截）、文件记录（PDF+四图 magic bytes 白名单、≤10MB、`life-files/{userId}/{id}.{ext}` 进 MinIO、DB 只存元数据）、**敏感文件默认私有**（sensitive 默认 true 徽标警示 + 跨用户 404）、模板（12 项内置）与推荐（未补齐推荐模板推导 + 按模板预填上传）；移动/删除两步确认（未经确认不动数据）。**对话协助后置 L2**：OpenAI 兼容网关抽象（`LIFE_ASSIST_*` 全环境变量、未配置 503 降级不伪造），设计入任务书 D6，L1 无假入口。测试：后端 221、lifefolder 4、e2e 42 项全绿。
- **Growth G2 已交付（2026-11-14，任务书 `CHPLI成长G2切片任务书.md`）**：技能节点（熟练度 0–5、可选从属目标 SetNull、每用户唯一名）、学习资源=技能↔书签关联、实践证据=技能↔笔记关联、定期回顾（回顾日期/内容/可选从属目标、既有 Memo 关联、「安排下次回顾」经 MemoService 生成纯日期 Memo 且幂等——悬挂自愈）；**G1 goal_links 统一迁移为 growth_links(ownerType×module×refId)**（迁移内 INSERT…SELECT 无损复制），校验/解析注册表扩至 MemoService。growth remote 增加技能/回顾两页 + calendar 消费 memos 深链接。
- **Growth G1 已交付（2026-11-13，任务书 `CHPLI成长G1切片任务书.md`，M2' 第四个模块）**：新 remote `apps/growth`（端口 3005）；职业目标+里程碑+**派生进度**（done/total，单一事实源）四态手动流转（无自动变更）；**跨模块关联机制**：`goal_links(goalId,module,refId)` 唯一约束幂等，归属校验与标题解析只经属主模块 Service（Notes/Bookmarks，不直读数据表），悬挂链接读取时省略；「打开」经 sessionStorage 信箱 + `chpli2-navigate` host 事件 + 目标 remote 挂载消费（规避懒加载时序）。
- **Bookmarks B1 已交付（2026-11-13，任务书 `CHPLI书签B1切片任务书.md`，M2' 第三个模块）**：新 remote `apps/bookmarks`（端口 3004）；分类（复用 Memo 标签约束）、描述封面图（对象存储 `bookmark-covers/` + 行上元数据/存储键、替换删旧对象、书签删除清理对象）、卡片/列表视图与四种排序（localStorage 持久化）、点击统计（`POST /:id/click` 打开新标签同时计数）、**30 天不活跃灰色精简降级**（服务端 `inactive` 标志，COALESCE(lastClickedAt, createdAt) ≥ 30 天，前端灰色精简列表仅名称/分类/域名、点击复活闭环）。
- **Notes N2 已交付（2026-11-12，任务书 `CHPLI笔记N2切片任务书.md`）**：全文搜索（标题/正文 ILIKE 大小写不敏感 + 标签精确，与筛选组合）；双链 `[[uuid]]`（稳定 ID，渲染期解析标题，失效链接降级；反链按字面量实时计算、软删自动消失）；版本历史（每次保存同事务快照、每篇保留 50 版、恢复=新修订不改写历史）；附件（note_images 同构 memo_images，ObjectStorageService 提升 SharedModule 全局共用）。e2e 定位并修复真实并发缺陷：保存竞态 409 自动重取版本重试一次。
- **Notes N1 已交付（2026-11-12，任务书 `CHPLI笔记N1切片任务书.md`，M2' 首个模块）**：新 remote `apps/notes`（MF，端口 3003，Host 导航/认证/多语言复用）；笔记 CRUD + Markdown 安全渲染（react-markdown 默认转义原始 HTML）+ 标签/优先级（复用 Memo 模式：text[]、AND/OR 两级筛选、聚合端点）+ 防抖 1.5s 自动保存与 Cmd/Ctrl+S（乐观锁 409 冲突态）+ 三语文案。数据按用户隔离。
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
| Notes | N2 | 全文搜索 + 双链/反链（`[[id]]` 稳定 ID）+ 版本历史 + 附件（复用 M3 模式） | 已交付（2026-11-12，任务书 `CHPLI笔记N2切片任务书.md`） |
| Notes | N3 | 博客园风格编辑器（Tab/图标工具栏/分屏/自动备份/图片拖拽粘贴/TeX）+ 发布表单九字段与生命周期（定时调度/密码哈希）+ 阅读视图 + 列表角标置顶排序 | 已交付（2026-11-26，需求直接迭代；用户确认当前形态达标，后续持续优化） |
| Bookmarks | B1 | 分类/描述图片/卡片与列表/点击统计与排序/30 天不活跃灰色精简降级 | 已交付（2026-11-13，任务书 `CHPLI书签B1切片任务书.md`） |
| Growth & Career | G1 | 职业目标 + 里程碑 + 派生进度 + 跨模块关联（notes/bookmarks，属主 Service 校验） | 已交付（2026-11-13，任务书 `CHPLI成长G1切片任务书.md`） |
| Growth & Career | G2 | 技能节点 + 学习资源/实践证据（书签/笔记关联）+ 定期回顾（Memo 关联 + 安排下次回顾幂等） | 已交付（2026-11-14，任务书 `CHPLI成长G2切片任务书.md`） |
| Life Folder | L1 | 分类体系 + 文件记录（MinIO）+ 模板 + 推荐；敏感默认私有 | 已交付（2026-11-14，任务书 `CHPLI人生文件L1切片任务书.md`） |
| Life Folder | L2 | 对话协助（OpenAI 兼容网关，env 配置，未配置 503 降级） | 待启动（网关设计见 L1 任务书 D6） |

### Travel 模块（已交付部分保持）
- Plan/Memory 双形态、同级地图连线、日历同步投影已交付；随 M0 补用户隔离。

## 已决策事项

- 2026-11-26 **N3 编辑器核心决策（用户确认，需求直接迭代）**：技术栈沿用项目现状（CSS Modules + react-markdown + 等宽 textarea），**不引入 Tailwind/@uiw/react-md-editor**（与全仓样式体系、Module Federation 构建、AGENTS.md「复用现有模式」冲突）；**富文本备选模式留待后续迭代**（编辑器下拉链暂只含 Markdown）；发布表单九字段真实入库（迁移 `note_publish_fields`，空串归一 null、DTO 超长 400/服务层语义 422）；发布生命周期由发布按钮显式触发（draft/published/scheduled），**内容自动保存只发内容字段、不触碰发布元数据**（否则空密码会被自动清除、publishedAt 会被刷新）；定时发布=进程内 30s 清扫（`publishDue` 条件 UPDATE 幂等、重启补扫，不上外部 cron）；访问密码 scrypt+每笔记盐哈希、列 VARCHAR(160)、API 只回传 `hasAccessPassword`（undefined=不变/null=清除/''=保持/字符串=替换）；正文图片以 `note-image://<id>` 入 Markdown、预览自定义 img 组件经鉴权 API 解析为 blob URL；自动备份=1.5s 防抖服务端保存 + 800ms localStorage 快照（保存成功即清除；切换笔记时残留快照优先恢复并标记未保存）；**模块类构造器注入同样必须显式 `@Inject`**（tsx/esbuild 不发射 decorator metadata，NotesModule 定时器曾因此拿到 undefined 崩溃）；OpenAPI 快照随契约变更重生成（`test/contracts/openapi.snapshot.json`）。
- 2026-11-26 **时区口径修正**：日历到期标签（`Sidebar.dueLabel`）与成长回顾默认日期（`reviews.service todayKey`）统一用**服务器/浏览器本地日历日**——day key 全链路无时区语义，UTC 截取会在本地时区 ahead-of-UTC 的 00:00–08:00 窗口错位一天；纯日期算术（due.ts shiftKey 等）不受影响的保持 UTC 实现。
- 2026-11-25 **测试策略补充**：新增 `e2e/user-journey.spec.ts` 用户视角验证（注册→六模块 UI 创建数据→页面显示断言），与 API 级 `create-test-data.mjs` 互补；到期/重复类断言必须相对化（实例数随星期与时区窗口变化，禁止硬编码总数）。
- 2026-11-25 **重复规则精简为六选（用户规格）**：UI 预选项 = 不重复/每天/每周/每月/每季度/每年/自定义（`MEMO_REPEAT_UI_OPTIONS`）；**每季度语义重定义为「每季度的第 N 天」**（如 11-25=Q4 第 56 天 → 每季度第 56 天：02-25、05-26、08-25、11-25），季度不足 N 天收拢到季末；每月=每月同日（短月收拢）、每年=同年月日（2/29→2/28）、每周=同星期几、自定义=勾选星期（开始日期始终首次出现）。`monthlyByWeekday`/`semiannual` 转为存量兼容值（数据照常展开、编辑时可见，不再出现在新建选项）。
- 2026-11-25 **重复备忘按实例删除**：`memos.excludedDates date[]` 记录被单独删除的实例日期，`expandMemoToRange` 双端统一跳过（完成切换对已排除日期按 E50 拒绝）；`DELETE /api/memos/:id/instances/:date` 幂等（已排除日期返回 200 不变），非重复备忘 422；编辑面板删除重复备忘时提供「仅删除当天 / 删除全部重复 / 取消」三选，非重复备忘保持两步确认。同日：**custom 重复的开始日期始终为首次出现**（即使其星期未被勾选），修复「创建的重复备忘在视图中看不到」；表单星期选择下加提示文案。同日：日历模块字号下限 14px（`.cal-app` 覆盖 `--chpli-font-sm`，共享包不改），周视图「今天」日期由 28px 正圆改自适应胶囊（修竖排换行）。
- 2026-11-24 **Bug 修复轮（首页 + 日历）**：首页改 Netflix 风 hero + 核心价值观（C/H/P/L/I）与六模块卡片；Host `.shell` 高度收敛为 100vh（各模块内部滚动，日历三视图匹配窗口无整页滚动条）；月视图整格单击可建备忘并加灰色提示；编辑备忘未保存切换时弹「保存并打开 / 不保存 / 取消」并 toast 已保存；**重复规则新增 `custom`（`repeatDays` 0=周日…6=周六 + 沿用 repeatEnd 截止），预选项清理为 不重复/每天/每月(两种)/每季/每半年/每年/自定义**——`weekly`/`weekdays` 迁移为 custom（迁移 SQL 保序等价），`biweekly` 保留为存量兼容值不再出现在 UI；标签支持侧边栏重命名（跨备忘合并去重）与删除（`PATCH/DELETE /api/memos/tags`），标签与即将到期 header 显示总数。
- 2026-11-12 **M1 核心决策（详见任务书 D1–D6）**：Memo 纯日期（无时区/时刻，日期键 UTC 算术）；重复由前端 `expandMemoToRange` 展开；完成双轨（非重复 `completed_at` / 重复 `memo_completions`，后者 `@@unique(memo_id, date)` 幂等）；旧 Event UI 随 M1 退役（后端 events API 与 Travel 投影保留）；视图偏好存 localStorage、周起始固定周日；9 种重复短月/缺序数日一律收拢。
- 2026-11-14 **Life Folder L1 核心决策（详见任务书 D1–D9）**：分类内置种子（七类，迁移幂等）+ 自定义（树深 ≤2、同级唯一服务层校验、非空删除拦截）；文件白名单=PDF+四图 magic bytes、≤10MB、`life-files/{userId}/{id}.{ext}`；**敏感默认 true**；移动/删除前端两步确认；对话协助 L2=OpenAI 兼容网关（`LIFE_ASSIST_*` env、未配置 503 不伪造）；模板推荐=未补齐 recommended 模板前端推导。
- 2026-11-14 **Growth G2 核心决策（详见任务书 D1–D8）**：技能 goalId 可空 SetNull（删目标技能保留并置空）；熟练度 0–5 越界 422；**统一关联表 growth_links(ownerType: goal|skill|review × module: notes|bookmarks|memos, refId)** 取代 goal_links（迁移无损复制），多态无 FK、属主删除同事务自清；GoalsService 改造而契约不变；回顾 reviewedAt 纯日期默认今天、nextMemoId 唯一；**安排下次回顾=先落 nextMemoId 再经 MemoService.create（幂等），重复调用直接返回、悬挂（Memo 被删）换新 id 自愈**；memos 深链接由 calendar 挂载消费（宽窗口查询锚定日视图）。
- 2026-11-13 **Growth G1 核心决策（详见任务书 D1–D8）**：G1=目标+里程碑+派生进度+关联（notes/bookmarks）；进度=派生值不设手动（单一事实源）；状态四态手动切换、里程碑全完成不自动流转；目标日期纯日期；跨模块关联=goal_links 唯一约束幂等 + 属主 Service 校验/解析（不直读表）+ 悬挂链接读取省略 + sessionStorage 信箱/`chpli2-navigate` 事件/目标 remote 挂载消费；里程碑 completedAt 随 done/open 维护；连续变更 last-write-wins 防陈旧响应覆盖。
- 2026-11-13 **Bookmarks B1 核心决策（详见任务书 D1–D8）**：分类=categories text[]（Memo 标签约束复用，B1 不做筛选）；封面图=1:1 行内元数据+存储键（`bookmark-covers/{userId}/{bookmarkId}.{ext}`，替换删旧、删除清理对象）；URL 仅 http/https、domain 保存时落列；点击=每次 API 调用计一次（事件语义，不去重）；inactive 服务端计算（COALESCE ≥ 30 天含整 30 天）；排序四态白名单服务端执行；视图+排序 localStorage 持久化。
- 2026-11-12 **Notes N2 核心决策（详见任务书 D1–D8）**：双链= `[[uuid]]` 稳定 ID、渲染期解析标题、失效链接降级；反链=字面量实时计算不存储；搜索=Postgres ILIKE（标题/正文）+标签精确 has，组合既有筛选；版本=保存同事务快照、保留 50 版、恢复即新修订不改写历史；附件=note_images 同构 memo_images、ObjectStorageService 提升为 SharedModule 全局（Memo/Notes 共用，module 边界不破）；保存竞态 409 自动重取重试一次再提示冲突。
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
