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

/**
 * JWT signing/verification secret. Required in production; a loudly-named
 * development fallback keeps local runs and the e2e suite working without a
 * .env (services/api/.env carries a real value in this repo).
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'chpli2-dev-secret-do-not-use-in-prod';
}

// -- Object storage (M3): MinIO locally, any S3-compatible service via env.

export interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export function storageConfig(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY ?? 'chpli2',
    secretKey: process.env.S3_SECRET_KEY ?? 'chpli2-secret-key',
    bucket: process.env.S3_BUCKET ?? 'chpli2-memo-images',
    region: process.env.S3_REGION ?? 'us-east-1',
  };
}
