#!/usr/bin/env node
/**
 * CHPLI 全模块手工验证测试数据生成器。
 *
 * 目标账户：本地 dev 库的用户 `test`（脚本会自动补邮箱 test@example.com 并通过
 * 验证码通道 devCode 登录，无需密码）。所有记录使用固定 UUID，可重复运行（幂等）。
 *
 * 用法：node scripts/create-test-data.mjs
 * 前置：本地 pnpm dev 已在运行（API :4000，前端 :3000）。
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const API = 'http://localhost:4000';
const results = { ok: [], edge: [] };
const ok = (m) => {
  results.ok.push(m);
  console.log(`  ✓ ${m}`);
};
const edge = (m) => {
  results.edge.push(m);
  console.log(`  · ${m}`);
};

// ---------- 登录 ----------
// 优先直接注册拿 token；用户已存在（409）则补邮箱走 devCode 验证码通道。
// 旧假设（用户 test 一定存在且带邮箱）不可靠：库可能被重置/清理过。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const registerRes = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'test', password: 'test-dev-password' }),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let login = registerRes.body;
// 无论哪条路径拿到账号，都确保邮箱已绑定（验证码/重置密码依赖它）；
// 新注册路径不经过 409 分支，漏绑会让 test@example.com 收不到验证码。
execFileSync(
  'docker',
  [
    'exec',
    'chpli2-postgres',
    'psql',
    '-U',
    'chpli2',
    '-d',
    'chpli2',
    '-c',
    "UPDATE users SET email='test@example.com' WHERE username='test';",
  ],
  { stdio: 'pipe' },
);
if (!login.token) {
  if (registerRes.status !== 409) {
    throw new Error(
      `register failed: HTTP ${registerRes.status} ${JSON.stringify(registerRes.body)}`,
    );
  }
  const requestCode = () =>
    fetch(`${API}/api/auth/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'test@example.com' }),
    }).then((r) => r.json());
  let codeRes = await requestCode();
  if (!codeRes.devCode) {
    // 60s 重发冷却：等一个冷却周期再试（未注册/无邮箱时响应同样无 devCode，
    // 但上面已确认用户存在，这里只需处理冷却）。
    console.log('  验证码冷却中，等待 65s 后重试…');
    await sleep(65_000);
    codeRes = await requestCode();
  }
  if (!codeRes.devCode) {
    throw new Error(
      `no devCode returned (user test missing or still cooling down): ${JSON.stringify(codeRes)}`,
    );
  }
  login = await fetch(`${API}/api/auth/login-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'test@example.com', code: codeRes.devCode }),
  }).then((r) => r.json());
}
if (!login.token) throw new Error(`login failed: ${JSON.stringify(login)}`);
const H = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
console.log(`已登录用户: ${login.user.username} (${login.user.id})`);
const uid = login.user.id;

async function api(method, path, body) {
  const headers = { Authorization: H.Authorization };
  if (body !== undefined && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  return data;
}
const today = new Date();
const d = (offset) => {
  const t = new Date(today.getTime() + offset * 86_400_000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// 8x8 PNG（合法魔数，可过 sniffing）
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAKklEQVR4nGP8//8/AzGAiShVDAwM/0kBI0Datm0bIcDIyEiCu0eNBgIAAP//w9keAWU54LEAAAAASUVORK5CYII=',
  'base64',
);
// 最小合法单页 PDF
const pdf = (label) => {
  const content = `BT /F1 18 Tf 40 700 Td (${label}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++)
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
};

const imgForm = (buf, filename, extra = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.append(k, String(v));
  f.append(
    'file',
    new Blob([buf], { type: filename.endsWith('.png') ? 'image/png' : 'application/pdf' }),
    filename,
  );
  return f;
};

// ---------- 1. 日历 Memo ----------
console.log('\n■ 日历（备忘录）');
const M = (name) => `00000000-0000-4000-8000-${String(name).padStart(12, '0')}`;
const memos = [
  { n: 1, title: '提交周报（今日截止）', date: d(0), priority: 'high', tags: ['工作'] },
  { n: 2, title: ' dentist 洗牙预约', date: d(2), priority: 'medium', tags: ['健康'] },
  { n: 3, title: '逾期 3 天：给妈妈回电话', date: d(-3), priority: 'high', tags: ['个人'] },
  { n: 4, title: '逾期 10 天（回看窗口之外）', date: d(-10), priority: 'low' },
  { n: 5, title: '窗口边界：3 天后（显示）', date: d(3), priority: 'medium' },
  { n: 6, title: '窗口边界：4 天后（不显示）', date: d(4), priority: 'medium' },
  {
    n: 7,
    title: '每日站立会',
    date: d(0),
    priority: 'none',
    repeat: 'daily',
    repeatEnd: d(30),
    tags: ['工作'],
  },
  {
    n: 8,
    title: '工作日晨跑',
    date: d(0),
    priority: 'low',
    repeat: 'weekdays',
    repeatEnd: d(20),
    tags: ['健康'],
  },
  {
    n: 9,
    title: '每周五团队例会',
    date: d((5 - new Date().getDay() + 7) % 7),
    priority: 'medium',
    repeat: 'weekly',
    repeatEnd: d(40),
    tags: ['工作'],
  },
  {
    n: 10,
    title: '双周一对一',
    date: d(1),
    priority: 'none',
    repeat: 'biweekly',
    repeatEnd: d(60),
  },
  {
    n: 11,
    title: '每月 31 日月结（短月收拢）',
    date: '2026-01-31',
    priority: 'medium',
    repeat: 'monthly',
    tags: ['财务'],
  },
  { n: 12, title: '每月第二个周二发薪', date: d(0), priority: 'high', repeat: 'monthlyByWeekday' },
  { n: 13, title: '季度体检', date: d(5), priority: 'medium', repeat: 'quarterly' },
  { n: 14, title: '半年度牙齿检查', date: d(8), priority: 'low', repeat: 'semiannual' },
  { n: 15, title: '每年结婚纪念日', date: d(9), priority: 'high', repeat: 'yearly' },
  {
    n: 16,
    title: '10 个标签上限样例（含 32 字符最长标签）',
    date: d(1),
    priority: 'none',
    tags: [
      '标签一',
      '标签二',
      '标签三',
      '标签四',
      '标签五',
      '标签六',
      '标签七',
      '标签八',
      '标签九',
      '12345678901234567890123456789012',
    ],
  },
  { n: 17, title: 'English memo: renew passport', date: d(6), priority: 'low', tags: ['personal'] },
  { n: 18, title: 'Deutsch Vokabeln wiederholen', date: d(1), priority: 'none', tags: ['Lernen'] },
  {
    n: 19,
    title: '长备注示例',
    date: d(2),
    priority: 'none',
    note: '这是一段很长的备注。\n'.repeat(20),
  },
  {
    // 回归样例：自定义重复下开始日期的星期不在所选集合中。修复前该备忘
    // 首次出现要等下一个所选星期，当前视图窗口内一个实例都没有（不可见）。
    n: 20,
    title: '自定义重复：开始日为非所选星期（当天仍应显示）',
    date: d(0),
    priority: 'high',
    repeat: 'custom',
    repeatDays: [(new Date().getDay() + 1) % 7], // 故意不含开始日（今天）的星期
    repeatEnd: d(20),
    tags: ['工作'],
  },
  {
    n: 21,
    title: '自定义重复：每周一/三/五 健身课',
    date: d(0),
    priority: 'low',
    repeat: 'custom',
    repeatDays: [1, 3, 5],
    tags: ['健康'],
  },
];
for (const m of memos) {
  await api('POST', '/api/memos', {
    id: M(m.n),
    title: m.title,
    date: m.date,
    priority: m.priority,
    repeat: m.repeat ?? 'none',
    repeatEnd: m.repeatEnd ?? null,
    repeatDays: m.repeatDays ?? [],
    note: m.note ?? null,
    tags: m.tags ?? [],
  });
}
ok(
  `备忘录 ${memos.length} 条（UI 全部重复预选项 + legacy 规则、自定义重复开始日回归样例、今日/逾期/窗口边界、标签上限、三语标题、长备注）`,
);
// 例会锚定到即将到来的周五；幂等归位旧数据后完成未来两个周五实例
const friOffset = (5 - new Date().getDay() + 7) % 7;
const m9 = await api('GET', `/api/memos/${M(9)}`);
for (const off of [7, 14]) {
  if (m9.completions.includes(d(off))) {
    await api('PUT', `/api/memos/${M(9)}/completion`, { date: d(off), completed: false });
  }
}
if (m9.date !== d(friOffset)) {
  await api('PATCH', `/api/memos/${M(9)}`, { date: d(friOffset), updatedAt: m9.updatedAt });
}
await api('PUT', `/api/memos/${M(9)}/completion`, { date: d(friOffset + 7), completed: true });
await api('PUT', `/api/memos/${M(9)}/completion`, { date: d(friOffset + 14), completed: true });
ok('每周例会（锚定周五）已完成 2 个未来实例（导航到对应周可见划线）');
// 每日站立会删除 d(+3) 这一个实例（幂等）：演示按实例删除与 excludedDates
await api('DELETE', `/api/memos/${M(7)}/instances/${d(3)}`);
ok(`每日站立会已删除 ${d(3)} 当天的单个实例（excludedDates，其余日期照常展开）`);
await api(
  'POST',
  `/api/memos/${M(1)}/images`,
  imgForm(PNG, 'a.png', { id: '60000000-0000-4000-8000-000000000001' }),
);
await api(
  'POST',
  `/api/memos/${M(1)}/images`,
  imgForm(PNG, 'b.png', { id: '60000000-0000-4000-8000-000000000002' }),
);
ok('今日备忘上传 2 张图片');

// ---------- 2. Travel ----------
console.log('\n■ 行程');
const T = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// 参考数据（国家/城市/地点）可能被测试重置清空：为空时自动重新 seed。
let countries = await api('GET', '/api/travel/countries');
if (!countries.length) {
  console.log('  旅行参考数据为空，重新执行 db:seed…');
  execFileSync('pnpm', ['-C', 'services/api', 'db:seed'], { stdio: 'inherit' });
  countries = await api('GET', '/api/travel/countries');
}
const cn = countries.find((c) => c.code === 'CN' || c.name?.includes('中国')) ?? countries[0];
const jp = countries.find((c) => c.code === 'JP' || c.name?.includes('日本')) ?? countries[1];
const cnCities = await api('GET', `/api/travel/countries/${cn.id}/cities`);
const sh = cnCities.find((c) => c.name?.includes('上海')) ?? cnCities[0];
const cd = cnCities.find((c) => c.name?.includes('成都')) ?? cnCities[1] ?? cnCities[0];
const shLocs = await api('GET', `/api/travel/cities/${sh.id}/locations`);
const locA = shLocs[0];
const locB = shLocs[1] ?? shLocs[0];

// 行程 POST 无客户端 id（cuid 服务端生成）且无列表/删除端点：用标题经 SQL
// 查重复用，多余的重复行程连同交通段一并清掉（FK 级联），保证脚本幂等。
const ensureTrip = async (title, type) => {
  const sql = (query) =>
    execFileSync(
      'docker',
      ['exec', 'chpli2-postgres', 'psql', '-U', 'chpli2', '-d', 'chpli2', '-tAc', query],
      { encoding: 'utf8' },
    ).trim();
  const existing = sql(
    `SELECT id FROM "Trip" WHERE "userId" = '${uid}' AND title = '${title}' ORDER BY "createdAt" ASC`,
  )
    .split('\n')
    .filter(Boolean);
  let id = existing[0];
  if (!id) {
    id = (await api('POST', '/api/travel/trips', { title, type })).id;
  }
  for (const extra of existing.slice(1)) {
    sql(`DELETE FROM "Trip" WHERE id = '${extra}' AND "userId" = '${uid}'`);
    console.log(`  · 清理重复行程「${title}」(${extra})`);
  }
  return { id, title };
};
const trip1 = await ensureTrip('日本关西 5 日游（计划）', 'PLAN');
const trip2 = await ensureTrip('2025 川西徒步（回忆）', 'MEMORY');
ok(`行程 2 个：${trip1.title} / ${trip2.title}（SQL 查重复用，重复已清理）`);
// 历史版本脚本在同一行程上重复插过交通段：先按 (行程, 方式, 出发时间) 去重保留最早一条。
execFileSync(
  'docker',
  [
    'exec',
    'chpli2-postgres',
    'psql',
    '-U',
    'chpli2',
    '-d',
    'chpli2',
    '-c',
    `DELETE FROM "Transport" t USING "Transport" keep WHERE t."tripId" = keep."tripId" AND t.mode = keep.mode AND COALESCE(t."plannedDepartureAt", t."actualDepartureAt") = COALESCE(keep."plannedDepartureAt", keep."actualDepartureAt") AND t.id > keep.id AND t."tripId" IN ('${trip1.id}', '${trip2.id}');`,
  ],
  { stdio: 'pipe' },
);
// 交通段同样按 方式+出发时间 查重（GET 行程详情含 transports），不存在才创建。
const ensureTransport = async (tripId, payload) => {
  const trip = await api('GET', `/api/travel/trips/${tripId}`);
  const timeKey = payload.plannedDepartureAt ?? payload.actualDepartureAt;
  const exists = trip.transports.some(
    (t) => t.mode === payload.mode && (t.plannedDepartureAt ?? t.actualDepartureAt) === timeKey,
  );
  if (!exists) await api('POST', `/api/travel/trips/${tripId}/transports`, payload);
};
await ensureTransport(trip1.id, {
  mode: 'FLIGHT',
  syncToCalendar: true,
  origin: { level: 'COUNTRY', id: cn.id },
  destination: { level: 'COUNTRY', id: jp.id },
  plannedDepartureAt: '2026-12-01T08:30:00+08:00',
  plannedArrivalAt: '2026-12-01T12:05:00+09:00',
});
await ensureTransport(trip1.id, {
  mode: 'TRAIN',
  origin: { level: 'CITY', id: sh.id },
  destination: { level: 'CITY', id: cd.id },
  plannedDepartureAt: '2026-12-02T07:00:00+08:00',
  plannedArrivalAt: '2026-12-02T15:20:00+08:00',
});
await ensureTransport(trip1.id, {
  mode: 'SUBWAY',
  syncToCalendar: false,
  origin: { level: 'LOCATION', id: locA.id },
  destination: { level: 'LOCATION', id: locB.id },
  plannedDepartureAt: '2026-12-02T16:10:00+08:00',
  plannedArrivalAt: '2026-12-02T16:40:00+08:00',
});
await ensureTransport(trip2.id, {
  mode: 'BUS',
  origin: { level: 'CITY', id: cd.id },
  destination: { level: 'CITY', id: sh.id },
  actualDepartureAt: '2025-04-05T08:00:00+08:00',
  actualArrivalAt: '2025-04-05T18:30:00+08:00',
});
ok('交通段 4 个（国家/城市/位置三级，PLAN 含同步日历段，MEMORY 仅实际时间；按 方式+时间 查重）');
edge('同城起终点相同、跨层级连接会被 422 拒绝（设计约束，未创建）');

// ---------- 3. Notes ----------
console.log('\n■ 笔记');
const N = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const note1 = await api('POST', '/api/notes', {
  id: N(1),
  title: 'CHPLI 使用手册草稿',
  priority: 'high',
  tags: ['手册', 'CHPLI'],
  body: [
    '# CHPLI 使用手册',
    '',
    '## 快速上手',
    '',
    '- 左侧导航切换模块',
    '- 日历支持 **月/周/日** 三视图',
    '',
    '## 代码示例',
    '',
    '```ts',
    'const memo = await createMemo({ title: "示例" });',
    '```',
    '',
    '| 模块 | 用途 |',
    '| --- | --- |',
    '| 日历 | 备忘与提醒 |',
    '| 笔记 | 知识管理 |',
    '',
    `相关笔记：[[${N(2)}]]`,
  ].join('\n'),
});
const note2 = await api('POST', '/api/notes', {
  id: N(2),
  title: '英语学习笔记',
  priority: 'medium',
  tags: ['学习'],
  body: `# 英语学习\n\n每日一句积累。\n\n相关：[[${N(1)}]]（手册）`,
});
await api('POST', '/api/notes', {
  id: N(3),
  title: '量子计算入门（长文）',
  priority: 'low',
  tags: ['阅读'],
  body: '# 量子计算入门\n\n' + '量子比特（qubit）是量子计算的基本单元。\n'.repeat(1200),
});
await api('POST', '/api/notes', {
  id: N(4),
  title: 'Q3 OKR 复盘',
  priority: 'medium',
  tags: ['工作'],
  body: '# Q3 OKR 复盘\n\n- O1 平台上线：完成 80%\n- O2 用户增长：未达预期',
});
await api('POST', '/api/notes', {
  id: N(5),
  title: '每日灵感',
  priority: 'none',
  body: '先做难事。',
});
ok('笔记 5 篇（markdown 大全、双向互链、约 40KB 长文、搜索关键词"量子"/"Q3 OKR"）');
// 手册保存 5 次制造版本历史
let updated = note1;
for (let i = 1; i <= 5; i++) {
  updated = await api('PATCH', `/api/notes/${note1.id}`, {
    title: note1.title,
    body: note1.body + `\n\n> 修订 v${i}：补充第 ${i} 轮意见。`,
    priority: 'high',
    tags: ['手册', 'CHPLI'],
    updatedAt: updated.updatedAt,
  });
}
ok('手册产生 6 个版本（历史面板可见、可恢复）');
await api(
  'POST',
  `/api/notes/${note1.id}/images`,
  imgForm(PNG, 'note-a.png', { id: '60000000-0000-4000-8000-000000000003' }),
);
await api(
  'POST',
  `/api/notes/${note1.id}/images`,
  imgForm(PNG, 'note-b.png', { id: '60000000-0000-4000-8000-000000000004' }),
);
ok('手册上传 2 张图片');

// ---- 发布生命周期矩阵（draft/published/scheduled × pinned/showOnHome/category/高级面板） ----
const patchNote = async (id, fields) => {
  const fresh = await api('GET', `/api/notes/${id}`);
  return api('PATCH', `/api/notes/${id}`, { ...fields, updatedAt: fresh.updatedAt });
};
// 归一化：矩阵之外的全部笔记重置为默认发布元数据。手工点过发布/置顶/首页展示
// 也不会让脚本输出漂移（测试数据生成器必须每次产出同一张"地"）。
const KEEP_META = new Set([N(6), N(7), N(8), N(9), N(10)]);
for (const note of await api('GET', '/api/notes')) {
  if (KEEP_META.has(note.id)) continue;
  if (note.publishStatus !== 'draft' || note.pinned || note.showOnHome) {
    await patchNote(note.id, { publishStatus: 'draft', publishAt: null, pinned: false, showOnHome: false });
    console.log(`  · 归一化发布元数据：${note.title}`);
  }
}
const publishNote = (id) => patchNote(id, { publishStatus: 'published' });

// N6 置顶 + 首页 + 显式摘要（首页卡片排序验证：置顶排最前）
await api('POST', '/api/notes', {
  id: N(6),
  title: '发布：NestJS 实战手记',
  priority: 'high',
  category: '技术随笔',
  tags: ['后端'],
  excerpt: '从模块边界到 Outbox 模式，记录一次完整后端切片的落地过程。',
  body: '# NestJS 实战手记\n\n模块化单体、Prisma 迁移与幂等设计。',
});
await patchNote(N(6), { pinned: true, showOnHome: true });
await publishNote(N(6));
// N7 首页（生活）
await api('POST', '/api/notes', {
  id: N(7),
  title: '发布：周末厨房实验',
  priority: 'none',
  category: '生活',
  tags: ['烹饪'],
  body: '# 周末厨房实验\n\n本周尝试无水咖喱，火候是关键。',
});
await patchNote(N(7), { showOnHome: true });
await publishNote(N(7));
// N8 首页（旅行）+ 关闭评论（高级面板 allowComments=false）
await api('POST', '/api/notes', {
  id: N(8),
  title: '发布：濑户内海跳岛攻略',
  priority: 'medium',
  category: '旅行',
  tags: ['日本'],
  body: '# 濑户内海跳岛攻略\n\n直岛看展、丰岛骑行、小豆岛过夜。',
});
await patchNote(N(8), { showOnHome: true, allowComments: false });
await publishNote(N(8));
// N9 定时发布（scheduled，未来两天 09:00）
await api('POST', '/api/notes', {
  id: N(9),
  title: '定时发布：月度读书清单',
  priority: 'low',
  category: '阅读',
  body: '# 月度读书清单\n\n本月读完三本，书评稍后补。',
});
const scheduleAt = new Date(Date.now() + 2 * 86_400_000);
scheduleAt.setHours(9, 0, 0, 0);
await patchNote(N(9), { publishStatus: 'scheduled', publishAt: scheduleAt.toISOString() });
// N10 密码保护（访问密码 demo，为评论系统铺路）
await api('POST', '/api/notes', {
  id: N(10),
  title: '发布：家庭账本模板（密码保护）',
  priority: 'medium',
  category: '财务',
  body: '# 家庭账本模板\n\n月固定支出与可变支出分列。',
});
await patchNote(N(10), { accessPassword: 'test1234' });
await publishNote(N(10));
// N11 数学公式（预览 TeX 开关 demo）
await api('POST', '/api/notes', {
  id: N(11),
  title: 'MathJax 与 KaTeX 笔记',
  priority: 'none',
  tags: ['前端'],
  body: '# 数学公式渲染\n\n质能方程：\n\n$$E = mc^2$$\n\n以及行内公式 $a^2+b^2=c^2$。',
});
// N12 空正文（摘要兜底显示 —）
await api('POST', '/api/notes', { id: N(12), title: '占位：待填内容', priority: 'none', body: '' });
ok(
  '发布矩阵：置顶+首页×3 分类 / 定时发布×1 / 密码保护×1 / 关闭评论×1 / 显式摘要与正文派生摘要 / 数学公式 / 空正文',
);
// 批量笔记：让 NotesHome 超过一页（20），验证"加载更多"
const CYCLE = [
  { category: '技术随笔', priority: 'high' },
  { category: '生活', priority: 'none' },
  { category: '旅行', priority: 'medium' },
  { category: null, priority: 'low' },
];
for (let i = 1; i <= 22; i++) {
  const c = CYCLE[i % CYCLE.length];
  await api('POST', '/api/notes', {
    id: `20000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
    title: `批量笔记 ${String(i).padStart(2, '0')}`,
    priority: c.priority,
    ...(c.category ? { category: c.category } : {}),
    body: `第 ${i} 篇批量笔记的正文内容。`,
  });
}
ok('批量笔记 22 篇（NotesHome 超过一页，验证加载更多；分类/优先级轮换覆盖筛选）');

// ---------- 4. Bookmarks ----------
console.log('\n■ 书签');
const B = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const bms = [
  {
    n: 1,
    title: 'React 官方文档',
    url: 'https://react.dev',
    description: 'React 学习的第一参考。',
    categories: ['dev', 'react'],
  },
  {
    n: 2,
    title: 'TypeScript Handbook',
    url: 'https://www.typescriptlang.org/docs/',
    description: 'TS 语言手册。',
    categories: ['dev'],
  },
  {
    n: 3,
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/zh-CN/',
    description: 'Web 平台权威参考。',
    categories: ['dev', '文档'],
  },
  {
    n: 4,
    title: 'Ant Design',
    url: 'https://ant.design',
    description: '企业级 UI 设计语言。',
    categories: ['design'],
  },
  {
    n: 5,
    title: 'Refactoring Guru',
    url: 'https://refactoring.guru',
    description:
      '重构与设计模式图解，内容较长用于验证描述截断效果——' +
      '这是一段故意写得很长的描述。'.repeat(6),
    categories: ['dev', '阅读'],
  },
  {
    n: 6,
    title: '少数派',
    url: 'https://sspai.com',
    description: '高效工作与生活内容。',
    categories: ['阅读'],
  },
  {
    n: 7,
    title: 'GitHub',
    url: 'https://github.com',
    description: '',
    categories: ['dev', '工具'],
  },
  {
    n: 8,
    title: 'Excalidraw',
    url: 'https://excalidraw.com',
    description: '手绘风格画图。',
    categories: [],
  },
];
for (const b of bms) {
  await api('POST', '/api/bookmarks', {
    id: B(b.n),
    title: b.title,
    url: b.url,
    description: b.description,
    categories: b.categories,
  });
}
const clicks = { 1: 6, 2: 3, 3: 1, 4: 4, 6: 2, 7: 10 };
for (const [n, count] of Object.entries(clicks))
  for (let i = 0; i < count; i++) await api('POST', `/api/bookmarks/${B(n)}/click`);
await api('PUT', `/api/bookmarks/${B(4)}/cover`, imgForm(PNG, 'cover.png'));
await api('PUT', `/api/bookmarks/${B(2)}/cover`, imgForm(PNG, 'cover.png'));
ok(`书签 ${bms.length} 个（点击 0/1/2/3/4/6/10 次分布、2 张封面、1 个空分类、1 个超长描述）`);
edge('Excalidraw 保持 0 点击，稍后由脚本外 SQL 回退 lastClickedAt 演示 30 天不活跃降级');

// ---------- 5. Growth ----------
console.log('\n■ 成长');
const G = (n) => `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const goal1 = await api('POST', '/api/goals', {
  id: G(1),
  title: '成为全栈工程师',
  description: '3 年内从前端成长到全栈（NestJS + Prisma + PostgreSQL）。',
  targetDate: '2028-12-31',
});
await api('POST', '/api/goals', { id: G(2), title: '跑完半程马拉松', targetDate: '2027-03-31' });
await api('POST', '/api/goals', { id: G(3), title: '通过 PMP 认证', targetDate: '2026-06-30' });
await api('POST', '/api/goals', { id: G(4), title: '旧目标：系统学习摄影', targetDate: null });
ok('目标 4 个（active/paused 待手动流转/achieved 手动标记/archived）');
const ms1 = [
  ['掌握 NestJS', '2026-06-30', 'done'],
  ['独立交付一个完整模块', '2027-06-30', 'open'],
  ['主导一次跨模块联调', '2027-12-31', 'open'],
  ['完成性能优化专项', '2028-06-30', 'open'],
];
for (let i = 0; i < ms1.length; i++)
  await api('POST', `/api/goals/${goal1.id}/milestones`, {
    id: `41000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: ms1[i][0],
    date: ms1[i][1],
  });
const goal3 = await api('GET', `/api/goals/${G(3)}`);
await api('POST', `/api/goals/${G(3)}/milestones`, {
  id: '41000000-0000-4000-8000-000000000099',
  title: '报名并完成培训',
  date: '2026-03-31',
});
const goal3b = await api('GET', `/api/goals/${G(3)}`);
await api('PATCH', `/api/goals/${G(3)}/status`, {
  status: 'achieved',
  updatedAt: goal3b.updatedAt,
}).catch(() =>
  api('PATCH', `/api/goals/${G(3)}`, { status: 'achieved', updatedAt: goal3b.updatedAt }),
);
// 目标状态流转（active 是默认值）
await api('PATCH', `/api/goals/${G(2)}`, {
  status: 'paused',
  updatedAt: (await api('GET', `/api/goals/${G(2)}`)).updatedAt,
});
await api('PATCH', `/api/goals/${G(4)}`, {
  status: 'archived',
  updatedAt: (await api('GET', `/api/goals/${G(4)}`)).updatedAt,
});
ok('里程碑 5 个；目标 2 paused、目标 3 achieved、目标 4 archived');
await api('PUT', `/api/goals/${goal1.id}/links`, { module: 'notes', refId: note1.id });
await api('PUT', `/api/goals/${goal1.id}/links`, { module: 'bookmarks', refId: B(1) });
ok('目标 1 关联笔记《CHPLI 使用手册草稿》+ 书签《React 官方文档》');
const sk1 = await api('POST', '/api/skills', {
  id: G(11),
  name: 'NestJS',
  level: 3,
  goalId: goal1.id,
});
await api('POST', '/api/skills', { id: G(12), name: 'PostgreSQL', level: 5 });
await api('POST', '/api/skills', { id: G(13), name: 'Deutsch', level: 1 });
ok('技能 3 个（熟练度 1/3/5，NestJS 挂在目标 1 下）');
await api('PUT', `/api/skills/${sk1.id}/links`, { module: 'notes', refId: note1.id });
ok('NestJS 技能关联手册笔记（证据）');
const dup = await fetch(`${API}/api/skills`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ id: randomUUID(), name: 'NestJS', level: 4 }),
});
edge(`重复技能名 NestJS -> HTTP ${dup.status}（重名 409 约束生效）`);
const rv1 = await api('POST', '/api/reviews', {
  id: G(21),
  title: '月度回顾 · 2026-10',
  content: '本月完成了 M1 里程碑，下月重点：跨模块联调。',
  reviewedAt: '2026-10-31',
  goalId: goal1.id,
});
await api('POST', '/api/reviews', {
  id: G(22),
  title: '周记 · 本周杂感',
  content: '保持节奏，减少上下文切换。',
  reviewedAt: d(0),
  goalId: null,
});
await api('POST', `/api/reviews/${rv1.id}/schedule-next-memo`, { date: d(30) });
ok('回顾 2 篇（一篇挂目标并安排下次回顾 → 自动生成备忘）');

// ---------- 6. LifeFolder ----------
console.log('\n■ 人生文件夹');
const L = (n) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cats = await api('GET', '/api/life-folder/categories');
const catOther = cats.find((c) => !c.builtIn || c.name?.includes('其他')) ?? cats[cats.length - 1];
const tplIdCard = (await api('GET', '/api/life-folder/templates')).find((t) =>
  t.name?.includes('身份证'),
)?.id;
// POST categories 返回整棵分类树且重名 409——按存在性跳过保证可复跑
let tree = await api('GET', '/api/life-folder/categories');
if (!tree.some((c) => c.name === '宠物' && !c.builtIn))
  await api('POST', '/api/life-folder/categories', { name: '宠物' });
tree = await api('GET', '/api/life-folder/categories');
const pet = tree.find((c) => c.name === '宠物' && !c.builtIn);
if (!pet.children.some((c) => c.name === '医疗记录'))
  await api('POST', '/api/life-folder/categories', { name: '医疗记录', parentId: pet.id });
tree = await api('GET', '/api/life-folder/categories');
const petMed = tree.find((c) => c.name === '宠物').children.find((c) => c.name === '医疗记录');
ok(`自定义分类：宠物 / 医疗记录（树深 2 层，id ${petMed.id}）`);
await fetch(`${API}/api/life-folder/documents`, {
  method: 'POST',
  headers: { Authorization: H.Authorization },
  body: imgForm(pdf('ID Card Copy'), 'id-card.pdf', {
    id: L(1),
    title: '身份证复印件（正面）',
    categoryId: cats[0].id,
    sensitive: true,
    templateId: tplIdCard ?? '',
  }),
}).then(async (r) => {
  if (!r.ok) throw new Error(`doc1: ${await r.text()}`);
});
await fetch(`${API}/api/life-folder/documents`, {
  method: 'POST',
  headers: { Authorization: H.Authorization },
  body: imgForm(pdf('Vaccine Record'), 'vaccine.pdf', {
    id: L(2),
    title: '猫三联疫苗记录',
    categoryId: petMed.id,
    sensitive: true,
  }),
}).then(async (r) => {
  if (!r.ok) throw new Error(`doc2: ${await r.text()}`);
});
await fetch(`${API}/api/life-folder/documents`, {
  method: 'POST',
  headers: { Authorization: H.Authorization },
  body: imgForm(PNG, 'cat-food.png', {
    id: L(3),
    title: '猫粮比价截图',
    categoryId: pet.id,
    sensitive: false,
  }),
}).then(async (r) => {
  if (!r.ok) throw new Error(`doc3: ${await r.text()}`);
});
ok('文件 3 个（2 PDF + 1 图片；敏感默认；身份证挂模板 → 推荐区应少一项）');
const docList = await api('GET', '/api/life-folder/documents');
const doc3 = docList.find((x) => x.id === L(3));
const doc3b = await api('PATCH', `/api/life-folder/documents/${L(3)}`, {
  categoryId: catOther.id,
  updatedAt: doc3.updatedAt,
}).catch(() => null);
if (doc3b) ok(`猫粮比价已移动到「${catOther.name}」（移动演示）`);
else {
  await api('PUT', `/api/life-folder/documents/${L(3)}/file`, imgForm(PNG, 'cat-food.png'));
  edge('移动接口字段不同，文档保持原分类');
}
const bad = await fetch(`${API}/api/life-folder/documents`, {
  method: 'POST',
  headers: { Authorization: H.Authorization },
  body: imgForm(Buffer.from('plain text'), 'notes.txt', {
    id: L(9),
    title: '文本文件（应被拒）',
    categoryId: cats[0].id,
    sensitive: true,
  }),
});
edge(`上传 .txt -> HTTP ${bad.status}（类型白名单约束生效）`);

// ---------- 收尾：书签不活跃降级（SQL 回退时间，仅此一处绕过 API） ----------
execFileSync(
  'docker',
  [
    'exec',
    'chpli2-postgres',
    'psql',
    '-U',
    'chpli2',
    '-d',
    'chpli2',
    '-c',
    `UPDATE bookmarks SET "lastClickedAt" = NOW() - INTERVAL '35 days' WHERE id = '${B(8)}' AND "userId" = '${uid}';`,
  ],
  { stdio: 'pipe' },
);
ok('Excalidraw 的 lastClickedAt 已回退 35 天（演示不活跃灰色降级，SQL 直接更新已在文档说明）');

// ---------- 汇总 + 自检（环境/语义不符合预期时给出可读告警） ----------
const allNotes = await api('GET', '/api/notes');
const homeCards = await api('GET', '/api/notes/home');
const byStatus = {};
for (const n of allNotes) byStatus[n.publishStatus] = (byStatus[n.publishStatus] ?? 0) + 1;
const counts = {
  memos: (await api('GET', '/api/memos')).length,
  trips: Number(
    execFileSync(
      'docker',
      [
        'exec',
        'chpli2-postgres',
        'psql',
        '-U',
        'chpli2',
        '-d',
        'chpli2',
        '-tAc',
        `SELECT COUNT(*) FROM "Trip" WHERE "userId" = '${uid}'`,
      ],
      { encoding: 'utf8' },
    ).trim(),
  ),
  notes: allNotes.length,
  notesByStatus: byStatus,
  homeCards: homeCards.length,
  noteCategories: (await api('GET', '/api/notes/categories')).length,
  bookmarks: (await api('GET', '/api/bookmarks')).length,
  goals: (await api('GET', '/api/goals')).length,
  skills: (await api('GET', '/api/skills')).length,
  reviews: (await api('GET', '/api/reviews')).length,
  categories: (await api('GET', '/api/life-folder/categories')).length,
  documents: (await api('GET', '/api/life-folder/documents')).length,
  tags: (await api('GET', '/api/memos/tags')).length,
};
console.log('\n===== 创建完成，API 实测数量 =====');
console.log(JSON.stringify(counts, null, 2));

const problems = [];
// 首页卡片：置顶必须排第一，且只含 published + showOnHome
if (!homeCards.length || homeCards[0].title !== '发布：NestJS 实战手记')
  problems.push(`首页卡片置顶排序异常：${homeCards[0]?.title}`);
// 发布生命周期矩阵
if (byStatus.scheduled !== 1) problems.push(`定时发布应为 1 篇，实际 ${byStatus.scheduled}`);
if ((byStatus.published ?? 0) < 4) problems.push(`已发布应 ≥4 篇，实际 ${byStatus.published}`);
if (!allNotes.some((n) => n.hasAccessPassword)) problems.push('缺少密码保护笔记');
if (!allNotes.some((n) => n.allowComments === false)) problems.push('缺少关闭评论笔记');
// 备忘：按实例删除的 excludedDates 必须含 d(+3)
const m7 = await api('GET', `/api/memos/${M(7)}`);
if (!m7.excludedDates.includes(d(3))) problems.push('每日站立会缺少 excludedDates 实例删除记录');
// NotesHome 分页：非置顶笔记应超过一页（20）
const nonPinned = allNotes.filter((n) => !n.pinned).length;
if (nonPinned <= 20) problems.push(`非置顶笔记 ${nonPinned} 篇，不足以验证加载更多`);

if (problems.length) {
  console.log('\n⚠ 自检告警：');
  for (const m of problems) console.log(`  - ${m}`);
} else {
  console.log('\n自检通过：发布矩阵/置顶排序/密码/评论开关/实例删除/分页规模均符合预期');
}
console.log('\n边界/约束验证：');
for (const m of results.edge) console.log(`  - ${m}`);
