import { config as loadDotenv } from 'dotenv';

export const DEFAULT_DATABASE_URL =
  'postgresql://chpli2:chpli2@localhost:5432/chpli2?schema=public';

/**
 * Loads .env from the current working directory (services/api when scripts
 * run via pnpm) and applies the default DATABASE_URL fallback. Never
 * overrides variables that are already set in the environment.
 */
export function loadEnv(): void {
  loadDotenv();
  process.env.DATABASE_URL ??= DEFAULT_DATABASE_URL;
}

export function apiPort(): number {
  const raw = process.env.API_PORT;
  const port = raw ? Number.parseInt(raw, 10) : 4000;
  return Number.isNaN(port) ? 4000 : port;
}
