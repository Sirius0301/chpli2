import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(e2eDir, '..');
const logsDir = path.join(e2eDir, '.logs');

const reuseExistingServer = !process.env.CI;
const serverTimeout = 120_000;

/**
 * Spawns a dev server through a tiny wrapper that tees stdout/stderr into
 * e2e/.logs/<name>.log (webServer itself offers no per-server log file).
 */
function devServer(name: string, command: string): string {
  return [
    process.execPath,
    JSON.stringify(path.join(e2eDir, 'scripts', 'dev-server.mjs')),
    JSON.stringify(path.join(logsDir, `${name}.log`)),
    command,
  ].join(' ');
}

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: path.join(e2eDir, 'test-results'),
  globalSetup: path.join(e2eDir, 'global-setup.ts'),
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: devServer('api', `pnpm -C ${path.join(repoRoot, 'services', 'api')} start:dev`),
      url: 'http://localhost:4000/api/docs-json',
      reuseExistingServer,
      timeout: serverTimeout,
      cwd: repoRoot,
    },
    {
      command: devServer('host', `pnpm -C ${path.join(repoRoot, 'apps', 'host')} dev`),
      url: 'http://localhost:3000',
      reuseExistingServer,
      timeout: serverTimeout,
      cwd: repoRoot,
    },
    {
      command: devServer('travel', `pnpm -C ${path.join(repoRoot, 'apps', 'travel')} dev`),
      url: 'http://localhost:3001/remoteEntry.js',
      reuseExistingServer,
      timeout: serverTimeout,
      cwd: repoRoot,
    },
    {
      command: devServer('calendar', `pnpm -C ${path.join(repoRoot, 'apps', 'calendar')} dev`),
      url: 'http://localhost:3002/remoteEntry.js',
      reuseExistingServer,
      timeout: serverTimeout,
      cwd: repoRoot,
    },
    {
      command: devServer('notes', `pnpm -C ${path.join(repoRoot, 'apps', 'notes')} dev`),
      url: 'http://localhost:3003/remoteEntry.js',
      reuseExistingServer,
      timeout: serverTimeout,
      cwd: repoRoot,
    },
  ],
});
