#!/usr/bin/env node
/**
 * Lightweight i18n key parity check: zh-CN / en / de must expose the same
 * flat translation keys in every app. This is intentionally a source scan
 * (no app bootstrap) so it can run before typecheck and without a database.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const appsDir = join(process.cwd(), 'apps');
const failures = [];

for (const app of readdirSync(appsDir)) {
  const file = join(appsDir, app, 'src', 'i18n.ts');
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const markers = [
    { lang: 'zh-CN', re: /^\s*'zh-CN':\s*\{/m },
    { lang: 'en', re: /^\s*en:\s*\{/m },
    { lang: 'de', re: /^\s*de:\s*\{/m },
  ];
  const positions = markers.map((m) => {
    const match = m.re.exec(source);
    return { lang: m.lang, index: match ? match.index : -1 };
  });
  if (positions.some((p) => p.index < 0)) {
    failures.push(`${app}: missing one of zh-CN/en/de`);
    continue;
  }
  const keysByLang = new Map();
  positions.forEach((p, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].index : source.length;
    const block = source.slice(p.index, end);
    const keys = new Set(
      [...block.matchAll(/^\s+'([^']+)':/gm)]
        .map((match) => match[1])
        .filter((key) => key !== 'zh-CN')
        .map((key) => key.replace(/_(zero|one|two|few|many|other)$/, '')),
    );
    keysByLang.set(p.lang, keys);
  });
  const base = keysByLang.get('zh-CN');
  for (const lang of ['en', 'de']) {
    const keys = keysByLang.get(lang);
    const missing = [...base].filter((key) => !keys.has(key));
    const extra = [...keys].filter((key) => !base.has(key));
    if (missing.length || extra.length) {
      failures.push(
        `${app} ${lang}: missing ${missing.join(', ') || '-'} | extra ${extra.join(', ') || '-'}`,
      );
    }
  }
}

if (failures.length) {
  console.error('i18n key parity failed:\n' + failures.map((f) => `- ${f}`).join('\n'));
  process.exit(1);
}
console.log('i18n key parity: OK');
