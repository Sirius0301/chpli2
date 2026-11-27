# @chpli2/e2e

CHPLI2 的端到端测试（Playwright + Chromium），覆盖 Travel ↔ Calendar 垂直切片的主流程。

## 覆盖范围

- `memo-day-notes.spec.ts`（2026-11-27）：Memo 日视图当天 Notes 列表与编辑视图跳转、截断标题/tag 的 tooltip、Memo/Notes 侧栏与抽屉拖拽调宽及持久化。

单规格文件 `trip-calendar.spec.ts`：

1. **完整闭环** — 新建 PLAN 行程 → 添加 COUNTRY 级交通段（同步开关默认开）→
   断言提交中按钮禁用且无重复提交 → Calendar 出现恰好一个事件 → 修改计划时间后
   仍只有一个事件且时间已更新（幂等）→ `page.reload()` 后行程与事件仍在（持久化）→
   删除交通段（先取消确认对话框不删，再确认删除）→ 日历事件消失。
2. **领域规则** — MEMORY 行程的交通段不进入日历（且无同步开关）。
3. **校验** — 同端点 / 跨级（COUNTRY→CITY）线路：表单即时提示错误且提交被阻止；
   另用 request fixture 直接调 API 断言 400 与稳定 errorCode
   （`ROUTE_SAME_ENDPOINT` / `ROUTE_LEVEL_MISMATCH`）。
4. **i18n** — 语言切换器在 中文 / English / Deutsch 间切换导航文案。

测试自包含：每个用例自己创建行程与交通段；globalSetup 会幂等执行
`pnpm -C services/api db:migrate` 与 `db:seed`（参考地理数据）。

## 前置条件

- Node 24 + pnpm 11；PostgreSQL 已在 `localhost:5432` 运行（`pnpm dev:db` 用 Docker 启动；
  `DATABASE_URL` 默认为 `postgresql://chpli2:chpli2@localhost:5432/chpli2`）。
- Chromium 浏览器：`npx playwright install chromium`（只需一次）。

## 运行

```bash
# 在仓库根目录
pnpm install
npx playwright install chromium   # 首次
pnpm test:e2e                     # 等价于 pnpm -C e2e test / pnpm -C e2e test:e2e
```

`playwright.config.ts` 的 `webServer` 会自动启动 4 个服务（API :4000、host :3000、
travel :3001、calendar :3002），本地已占用对应端口时直接复用
（`reuseExistingServer: !process.env.CI`，CI 下要求端口空闲）。服务 stdout/stderr 被
`e2e/scripts/dev-server.mjs` 同时输出到控制台与 `e2e/.logs/<name>.log`，调试时先看日志。

强制重启所有服务：

```bash
lsof -ti:3000,3001,3002,4000 | xargs kill
pnpm test:e2e
```

失败时查看报告：`pnpm -C e2e report`（HTML report）。

## 与根测试体系的关系

- 本包**同时**提供 `test` 与 `test:e2e` 两个等价脚本（`playwright test`）。
- 仓库根 `package.json` 提供 `test:e2e`（`pnpm -C e2e test:e2e`）。
- 根 `pnpm -r test` / `pnpm test` 通过 `--filter '!./e2e'` **排除**本包，避免在没有
  浏览器环境时因缺 Chromium 而挂掉；端到端测试请显式使用 `pnpm test:e2e`。

## 已知限制

- 单 worker 串行（`workers: 1`），所有用例共享同一个数据库。
- 断言中的时间显示依赖浏览器与 Node 处于同一时区（配置固定为 `Asia/Shanghai`）。
- 运行结束后 Playwright 会自动关闭它启动的服务；复用已有服务时不会代为关闭。
