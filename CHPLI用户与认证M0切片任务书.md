# CHPLI 用户与认证（M0）切片任务书

> 范围：本地账号注册/登录、JWT 认证、全模块数据按用户完全隔离、Host 登录界面。
> 不在本切片：Portal 统一登录与 postMessage 集成（M5）、密码找回/邮箱验证、刷新令牌轮换、登录限流。
> 依据：产品定位「Portal 子应用、按用户完全隔离」；CHPLI 工程约束（Host 负责认证，业务模块为 Remote）。
> 前置：无。本切片为 Memo 化（M1）及所有后续切片的基础。

---

## 一、切片目标

用户可以用用户名 + 密码注册并登录；所有 API（除认证与文档端点外）必须携带有效令牌；Calendar 与 Travel 模块的全部用户数据按用户隔离，任何用户无法读取、修改或删除他人的数据（返回 404 而非 403，不泄露存在性）；旧演示数据划归默认用户 `chpli`（密码登录禁用，仅作数据迁移锚点）。

## 二、数据模型

### 2.1 users（新增）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 稳定 ID |
| username | varchar(32) unique | 大小写敏感，合法字符 [a-zA-Z0-9_.-]，3–32 位 |
| password_hash | varchar(128)? | bcrypt；null = 密码登录禁用（默认用户） |
| created_at / updated_at | timestamp | |

### 2.2 用户隔离迁移（迁移 `calendar_*_f4` 之后追加）

- 用户自有表加 `user_id` 非空列 + 索引 + FK：trips、calendars、events、reminders、calendar_events（travel 同步投影）
- transports 经由 trip 归属（不加列，查询经 trip join）
- 迁移内创建默认用户 `chpli`（固定 uuid，password_hash = null），既有数据全部划归该用户
- 共享种子数据（countries/cities/locations、holiday_entries）不加用户列
- `calendars.is_default` 语义升级为「每用户恰好一个默认日历」，唯一约束带 user_id 维度

## 三、接口契约

- `POST /api/auth/register` → `{ token, user }`；用户名冲突 409 `USERNAME_TAKEN`，格式非法 422
- `POST /api/auth/login` → `{ token, user }`；凭证错误 401 `INVALID_CREDENTIALS`（统一文案，不区分用户不存在/密码错误）
- `GET /api/auth/me` → `{ user }`；未认证 401 `UNAUTHORIZED`
- 其余全部路由：全局 AuthGuard，校验 `Authorization: Bearer <jwt>`，失效/缺失 401
- JWT：HS256，载荷 `{ sub: userId, username }`，有效期 30 天；密钥取 `JWT_SECRET` 环境变量（缺失时启动失败并提示，dev 可用 `.env.example` 占位）
- 登出为前端行为（丢弃本地令牌），无服务端状态
- `@chpli2/shared` 增加：RegisterDto/LoginDto/AuthResponse/UserDto、前端令牌存储键与错误码常量

## 四、核心决策

记录（2026-11-11）：

- **D1 技术选型**：bcryptjs（纯 JS，无原生编译）+ @nestjs/jwt；全局 `APP_GUARD` + `@Public()` 装饰器；`@CurrentUser()` 参数装饰器注入 userId。
- **D2 隔离实现**：服务层所有查询/写入强制带 `userId` 条件（不做全局 Prisma 中间件，显式可控）；测试覆盖跨用户访问。
- **D3 默认用户**：迁移创建 `chpli`（无密码），旧数据全部归属；e2e 与集成测试通过注册接口创建独立用户。
- **D4 令牌存储**：前端 localStorage（`chpli2-token`），各 remote 的 `api.ts` 请求封装统一注入 Authorization 头；M5 Portal 接入时再评估迁移方案。
- **D5 越权语义**：跨用户访问一律 404（含列表过滤、详情、更新、删除），不暴露资源存在性。

## 五、异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E32 | 未携带令牌或令牌失效 | 401 `UNAUTHORIZED` |
| E33 | 注册重名（含大小写差异） | 409 `USERNAME_TAKEN` |
| E34 | 密码错误 / 用户不存在 | 401 `INVALID_CREDENTIALS`（同一文案） |
| E35 | 访问他人日历/事件/行程/投影 | 404，与不存在一致 |
| E36 | 用户名或密码格式非法 | 422（前后端双重校验） |
| E37 | 默认用户 `chpli` 尝试密码登录 | 401 `INVALID_CREDENTIALS` |

## 六、前端交互

- Host：未认证时渲染登录/注册卡片（切换 Tab）；认证后进入现有导航 + remotes；顶部显示当前用户名与「登出」
- 三语文案（zh-CN/en/de）
- 登录/注册提交失败显示对应错误（重名、凭证错误、校验失败）
- 各 remote 无需自建登录 UI；401 响应统一跳回登录态（fetch 封装检测到 401 清除令牌并广播事件，Host 监听）

## 七、验收标准

- A32 注册→登录→me→登出闭环，错误凭证/重名被正确拦截（E33/E34/E36）
- A33 用户 A 创建的日历/事件/行程，用户 B 列表不可见、详情/修改/删除 404（E35）
- A34 默认用户 `chpli` 的旧数据在迁移后完好，登录禁用（E37）
- A35 每用户独立默认日历；新注册用户自动获得一个默认日历（沿用 F1+F2 规则，升级为按用户）
- A17 登录界面三语文案正确
- A19 刷新后登录态保持（localStorage 令牌）

## 八、测试覆盖要求

- **单元测试**：用户名/密码校验、令牌签发/校验辅助
- **集成测试**：E32–E37 全量；每模块（calendar/travel）各一组跨用户隔离用例
- **契约测试**：OpenAPI 新增 auth 路由（register/login/me），快照更新
- **端到端测试**：注册登录闭环 + 隔离抽查一条用户路径（建日历→登出→注册新用户→不可见）；既有全部 e2e 增加登录前置

## 九、假设（待确认）

- **H1** 本地账号为 Portal 接入前的过渡方案，M5 以 Portal SSO 取代或并存（并存时本地账号保留）
- **H2** 不做刷新令牌/设备管理；30 天过期重新登录可接受
- **H3** 登录限流、验证码等反滥用措施在公网部署前补（本工程阶段不实现）
- **H4** 用户名大小写敏感、不可改（改名另议）

## 十、完成定义（DoD）

迁移可重复执行且旧数据归属正确；E32–E37 全部有对应测试；A32–A35 与 A17/A19 通过；全部既有 e2e 在登录前置下回归通过；契约快照更新；`ROADMAP.md` 更新 M0 状态。

---

# 附录 A：邮箱/手机 + 密码/验证码登录（M0 增强，2026-11-11）

> 用户要求：登录标识支持用户名/邮箱/手机三种，凭据支持密码或验证码。注册时可绑定邮箱/手机（可选）。
> 不在本附录：真实 SMTP/短信网关接入（以可插拔投递接口预留，部署前接入）、找回密码流程、登录限流（仅最小冷却/尝试次数）。

## A.1 数据模型增量（新迁移，跟在 `20261111072436_auth_users` 之后）

- users 增加 `email varchar(255)` 可空唯一（入库统一小写）、`phone varchar(32)` 可空唯一（归一化：仅数字与可选前导 `+`）
- 新表 login_codes：
  | 字段 | 类型 | 说明 |
  |---|---|---|
  | id | uuid | |
  | channel | varchar(8) | EMAIL / PHONE |
  | destination | varchar(255) | 归一化后的邮箱/手机号 |
  | code | varchar(6) | 6 位数字 |
  | expires_at | timestamp | 生成后 10 分钟 |
  | consumed_at | timestamp? | 核销后非空 |
  | attempts | int | 校验失败计数，≥5 作废 |
  | created_at | timestamp | |

## A.2 接口契约增量

- `POST /api/auth/register`：body 增加可选 `email`、`phone`；冲突 409 `EMAIL_TAKEN` / `PHONE_TAKEN`；格式非法 422
- `POST /api/auth/login`：body 改为 `{ identifier, password }`，identifier 自动识别用户名/邮箱/手机；错误统一 401 `INVALID_CREDENTIALS`
- `POST /api/auth/code`：`{ identifier }`（仅接受邮箱/手机）→ `{ sent, expiresInSec, devCode? }`；60s 冷却内重发 429 `CODE_COOLDOWN`；identifier 未绑定任何账号时返回 `sent:false`（不泄露账号存在性，也不生成验证码）
- `POST /api/auth/login-code`：`{ identifier, code }` → `{ token, user }`；错误/过期/超次统一 401 `INVALID_CODE`
- 投递通道：`AUTH_CODE_TRANSPORT=log`（默认，非生产）时验证码写服务器日志并在响应附带 `devCode` 供 e2e/联调；生产必须配置真实通道（当前无实现时启动警告而非失败）
- UserDto 增加 `email: string | null`、`phone: string | null`

## A.3 核心决策（记录 2026-11-11）

- **D6 单字段标识符**：登录不做三个独立入口，一个 `identifier` 输入框按形态识别（含 `@`→邮箱；归一化后为纯数字或 `+` 开头→手机；否则用户名），前后端同一套 `detectIdentifierType` 逻辑（shared）
- **D7 验证码存储**：DB 持久化（login_codes），天然支持重启恢复与审计；每次发送作废该 destination 旧未用码；核销置 `consumed_at`
- **D8 防滥用最小集**：发送冷却 60s/identifier；单码校验上限 5 次；有效期 10 分钟。均为服务内实现，不引入限流中间件
- **D9 兼容性**：`/api/auth/login` 契约变更（username→identifier）属工作区内破坏性变更，所有调用点（remote、测试、e2e）同步更新

## A.4 异常清单（增量）

| # | 场景 | 期望行为 |
|---|---|---|
| E38 | 注册邮箱/手机已被他人绑定 | 409 `EMAIL_TAKEN` / `PHONE_TAKEN` |
| E39 | 邮箱/手机格式非法 | 422 |
| E40 | 验证码错误/过期/已核销/超次 | 401 `INVALID_CODE`（统一文案） |
| E41 | 60s 冷却内重复请求验证码 | 429 `CODE_COOLDOWN` |
| E42 | 验证码请求了未绑定账号的邮箱/手机 | 200 `sent:false`（无 devCode） |

## A.5 前端交互增量

- 登录卡片在「密码登录 / 验证码登录」两个子模式间切换；identifier 字段一个输入框通用三种形态
- 验证码模式：「发送验证码」按钮（成功后 60s 倒计时禁用），输入 6 位数字提交
- 注册表单增加可选邮箱、手机输入
- 三语文案同步（zh-CN/en/de）；新增错误码文案（EMAIL_TAKEN/PHONE_TAKEN/INVALID_CODE/CODE_COOLDOWN）

## A.6 验收标准（增量）

- A36 用户名/邮箱/手机 + 密码均可登录到同一账号
- A37 注册绑定邮箱/手机后可走「发送验证码→登录」闭环；错误码/过期码被拒（E40）
- A38 冷却内重发被拒（E41）；未绑定账号的 identifier 返回 sent:false（E42）
- A39 邮箱/手机冲突被 409 拦截（E38），三语文案正确
- A40 me 返回 email/phone 字段，旧令牌兼容（载荷不变）

## A.7 假设

- **H5** 验证码通道当前仅 `log`（开发用）；接入真实 SMTP/SMS 时实现同一投递接口即可，不影响契约
- **H6** 邮箱/手机一经注册暂不支持换绑（另议）；默认用户 chpli 无邮箱/手机，不可验证码登录
- **H7** `login` 接口直接替换为 identifier 契约（无过渡期），因为全部调用点在本工作区内
