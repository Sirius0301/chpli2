#!/usr/bin/env node
/**
 * Frees CHPLI's dev ports by terminating the node processes listening on them.
 * Runs automatically before `pnpm dev` (see the root package.json "predev").
 * Only ever touches node processes; anything else holding a port is reported
 * and left alone. Ports are dedicated to this workspace by convention
 * (host 3000, remotes 3001-3006, api 4000).
 */
import { execFileSync } from 'node:child_process';

const ports = process.argv.slice(2);
if (ports.length === 0) {
  console.error('usage: node scripts/kill-port-listeners.mjs <port...>');
  process.exit(1);
}

let pids;
try {
  const out = execFileSync(
    'lsof',
    ['-nP', `-iTCP:${ports.join(',')}`, '-sTCP:LISTEN', '-t'],
    { encoding: 'utf8' },
  ).trim();
  pids = out ? [...new Set(out.split('\n'))] : [];
} catch {
  pids = []; // lsof exits 1 when nothing listens
}

for (const pid of pids) {
  try {
    // `ps comm` may return a full path (e.g. node spawned via nvm/tsx) — match the basename.
    const cmd = execFileSync('ps', ['-o', 'comm=', '-p', pid], { encoding: 'utf8' }).trim();
    const binary = cmd.split('/').pop() ?? '';
    if (binary === 'node' || binary === 'tsx') {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`[predev] killed stale node listener on dev port (pid ${pid})`);
    } else {
      console.log(`[predev] port held by ${cmd} (pid ${pid}) — not node, leaving it alone`);
    }
  } catch {
    /* process exited between lsof and ps */
  }
}
