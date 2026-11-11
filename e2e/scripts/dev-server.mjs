/**
 * Dev-server wrapper used by Playwright's webServer config.
 *
 * Usage: node dev-server.mjs <log-file> <command...>
 *
 * Spawns <command> and tees its stdout/stderr to both the Playwright console
 * and <log-file> so failures can be debugged from e2e/.logs/*.log.
 * Exits with the wrapped command's exit code.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { dirname } from 'node:path';

const [logFile, ...command] = process.argv.slice(2);
if (!logFile || command.length === 0) {
  console.error('usage: node dev-server.mjs <log-file> <command...>');
  process.exit(2);
}

mkdirSync(dirname(logFile), { recursive: true });
const log = createWriteStream(logFile, { flags: 'a' });
log.write(`\n===== ${new Date().toISOString()} ${command.join(' ')} =====\n`);

const child = spawn(command[0], command.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => {
  log.write(chunk);
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  log.write(chunk);
  process.stderr.write(chunk);
});
child.on('error', (error) => {
  log.write(`failed to spawn: ${error.message}\n`);
  console.error(error);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  log.write(`exited code=${code} signal=${signal}\n`);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
