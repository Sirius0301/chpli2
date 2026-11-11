// M0 用户与认证：共享类型与前端存储约定。

/** localStorage key holding the JWT; read by every remote's api client. */
export const AUTH_TOKEN_STORAGE_KEY = 'chpli2-token';

/** localStorage key holding the cached current user (display only). */
export const AUTH_USER_STORAGE_KEY = 'chpli2-user';

export interface UserDto {
  id: string;
  username: string;
  /** Bound email (lowercased) or null. */
  email: string | null;
  /** Normalized phone (digits, optional leading +) or null. */
  phone: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  /** Optional; lowercased before storage. */
  email?: string;
  /** Optional; normalized before storage. */
  phone?: string;
}

export interface LoginDto {
  /** Username, email, or phone (auto-detected). */
  identifier: string;
  password: string;
}

export interface SendCodeDto {
  /** Email or phone bound to an existing account. */
  identifier: string;
}

export interface SendCodeResponseDto {
  /** False when no account is bound to the identifier (E42). */
  sent: boolean;
  expiresInSec: number;
  /** Present only with the dev `log` transport; never in production. */
  devCode?: string;
}

export interface LoginCodeDto {
  identifier: string;
  code: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

// ---------------------------------------------------------------------------
// Identifier helpers shared by front and back end (M0 增强).
// ---------------------------------------------------------------------------

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits, spaces, hyphens; may start with '+'. 5-20 chars after cleanup. */
export const PHONE_INPUT_PATTERN = /^\+?[0-9][0-9 -]{3,19}$/;

export type IdentifierType = 'email' | 'phone' | 'username';

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Strips spaces and hyphens; keeps a leading '+'. Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!PHONE_INPUT_PATTERN.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[ +-]/g, '');
  if (digits.length < 5 || digits.length > 20) return null;
  return hasPlus ? `+${digits}` : digits;
}

/** Classifies a login identifier (D6). */
export function detectIdentifierType(raw: string): IdentifierType {
  const value = raw.trim();
  if (value.includes('@')) return 'email';
  if (normalizePhone(value) !== null) return 'phone';
  return 'username';
}

// ---------------------------------------------------------------------------
// Browser-side helpers (no-ops under Node): token attachment and 401 handling.
// ---------------------------------------------------------------------------

/** Dispatched on window when an API call answers 401; Host clears its session. */
export const UNAUTHORIZED_EVENT = 'chpli2-unauthorized';

/** Merges the stored bearer token into request headers (browser only). */
export function authFetchHeaders(
  base?: Record<string, string>,
): Record<string, string> {
  if (typeof localStorage === 'undefined') return base ?? {};
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return { ...base, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/**
 * Clears the stored session and notifies the Host on a 401 response so every
 * remote converges back to the login screen without a reload (M0).
 * Dispatches on globalThis (=== window in browsers).
 */
export function handleAuthFailure(statusCode: number): void {
  if (statusCode !== 401 || typeof localStorage === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  const target = globalThis as unknown as { dispatchEvent: (event: Event) => void };
  target.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
}
