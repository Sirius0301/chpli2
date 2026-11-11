import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(e2eDir, '..');
const apiDir = path.join(repoRoot, 'services', 'api');

/**
 * Ensures the PostgreSQL schema is migrated and the reference geo data
 * (countries/cities/locations) exists. Both scripts are idempotent, so this
 * is safe to run before every test session.
 */
function run(script: string): void {
  const result = spawnSync('pnpm', ['-C', apiDir, script], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`globalSetup: "pnpm -C services/api ${script}" failed`);
  }
}

export default function globalSetup(): void {
  run('db:migrate');
  run('db:seed');
}
