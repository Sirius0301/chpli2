#!/usr/bin/env node
/**
 * Runs `verify` or the e2e suite against an isolated PostgreSQL database.
 *
 * The regular `pnpm verify` uses DATABASE_URL and the API tests call
 * resetDatabase(), which deletes every row in the target database. This
 * wrapper prevents that from touching a developer database.
 *
 * Usage:
 *   node scripts/run-with-test-db.mjs verify
 *   node scripts/run-with-test-db.mjs e2e
 *
 * TEST_DATABASE_URL overrides the default local test database. For a
 * non-local URL (CI service container), the database must already exist;
 * local Docker setup is created automatically.
 */
import { execFileSync, spawnSync } from 'node:child_process';

const DEFAULT_TEST_URL =
  'postgresql://chpli2:chpli2@localhost:5432/chpli2_test?schema=public';
const mode = process.argv[2];
const testUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL;

if (mode !== 'verify' && mode !== 'e2e') {
  console.error('usage: node scripts/run-with-test-db.mjs <verify|e2e>');
  process.exit(2);
}

function parseDb(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      name: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    };
  } catch {
    console.error(`[test-db] invalid TEST_DATABASE_URL: ${url}`);
    process.exit(1);
  }
}

function ensureLocalDatabase({ host, port, name }) {
  if (process.env.CI || process.env.SKIP_TEST_DB_CREATE === '1') {
    console.log('[test-db] CI mode: assuming the database already exists');
    return;
  }
  if (!['localhost', '127.0.0.1'].includes(host) || port !== '5432') {
    console.log('[test-db] non-local URL: assuming the CI database already exists');
    return;
  }
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    console.error(`[test-db] unsafe database name: ${name}`);
    process.exit(1);
  }
  try {
    const exists = execFileSync(
      'docker',
      [
        'exec',
        'chpli2-postgres',
        'psql',
        '-U',
        'chpli2',
        '-d',
        'postgres',
        '-tAc',
        `SELECT 1 FROM pg_database WHERE datname = '${name}'`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    if (exists !== '1') {
      execFileSync(
        'docker',
        [
          'exec',
          'chpli2-postgres',
          'psql',
          '-U',
          'chpli2',
          '-d',
          'postgres',
          '-c',
          `CREATE DATABASE "${name}"`,
        ],
        { stdio: 'ignore' },
      );
      console.log(`[test-db] created ${name}`);
    }
  } catch (error) {
    console.error(
      '[test-db] cannot prepare the local test database. Start it with `pnpm dev:db` ' +
        'or set TEST_DATABASE_URL to an existing PostgreSQL database.\n' +
        String(error),
    );
    process.exit(1);
  }
}

const db = parseDb(testUrl);
ensureLocalDatabase(db);

console.log(`[test-db] using ${testUrl}`);
const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  ...(mode === 'e2e' ? { E2E_ISOLATED_DB: '1' } : {}),
};
const args = mode === 'verify' ? ['verify'] : ['-C', 'e2e', 'test:e2e'];
const result = spawnSync('pnpm', args, { stdio: 'inherit', env });
process.exit(result.status ?? 1);
