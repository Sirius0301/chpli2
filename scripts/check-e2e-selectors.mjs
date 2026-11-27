#!/usr/bin/env node
/**
 * Regression guard for private CSS-class locators in Playwright specs.
 *
 * New specs should use role/label/text or data-testid. Existing specs are
 * allowed to keep their historical class locators, but a file may only go
 * down over time. The baseline is updated deliberately with `--update`.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const e2eDir = join(process.cwd(), 'e2e');
const baselinePath = join(e2eDir, 'legacy-class-selectors.json');
const update = process.argv.includes('--update');
const files = readdirSync(e2eDir)
  .filter((name) => name.endsWith('.spec.ts'))
  .sort();

function countClassLocators(source) {
  return [...source.matchAll(/locator\(\s*['"`]\.[A-Za-z0-9_-]+/g)].length;
}

const current = {};
for (const file of files) {
  const source = readFileSync(join(e2eDir, file), 'utf8');
  const count = countClassLocators(source);
  if (count > 0) current[file] = count;
}

if (update || !existsSync(baselinePath)) {
  writeFileSync(baselinePath, JSON.stringify({ files: current }, null, 2) + '\n');
  console.log(`[e2e-selectors] baseline written (${Object.values(current).reduce((a, b) => a + b, 0)} locators)`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).files ?? {};
const failures = [];
for (const [file, count] of Object.entries(current)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) {
    failures.push(`${file}: ${count} private class locators (baseline ${allowed})`);
  }
}
const currentTotal = Object.values(current).reduce((a, b) => a + b, 0);
const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
if (currentTotal > baselineTotal) {
  failures.push(`total: ${currentTotal} (baseline ${baselineTotal})`);
}

if (failures.length) {
  console.error(
    'New private CSS-class locators are not allowed; use getByRole/getByLabel/getByText/getByTestId.\n' +
      failures.map((f) => `- ${f}`).join('\n') +
      '\nIf this is a deliberate legacy migration, lower the count and run `node scripts/check-e2e-selectors.mjs --update`.',
  );
  process.exit(1);
}
console.log(`[e2e-selectors] OK (${currentTotal} legacy class locators, no increase)`);
