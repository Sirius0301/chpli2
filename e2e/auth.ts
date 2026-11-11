import { expect, type Page, type APIResponse } from '@playwright/test';

/**
 * M0 auth fixture: registers a fresh user (unique per test) and seeds the
 * browser session so the Host shell skips the login card. Returns a bearer
 * token for direct APIRequestContext calls (Playwright requests do not carry
 * the browser's localStorage).
 */
export async function signIn(page: Page, username: string): Promise<string> {
  const res = await page.request.post('/api/auth/register', {
    data: { username, password: 'e2e-password-123' },
  });
  expect(res.ok(), `register ${username}: ${await res.text()}`).toBeTruthy();
  const { token, user } = (await res.json()) as {
    token: string;
    user: { id: string; username: string; createdAt: string };
  };
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('chpli2-token', t);
      localStorage.setItem('chpli2-user', JSON.stringify(u));
    },
    [token, user] as const,
  );
  return token;
}

/** Minimal authenticated wrapper around page.request (bearer header attached). */
export function authedApi(page: Page, token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    // Same call shape as page.request.* : options carry `data`.
    get: (url: string, options?: { data?: unknown }): Promise<APIResponse> =>
      page.request.get(url, { ...options, headers }),
    post: (url: string, options?: { data?: unknown }): Promise<APIResponse> =>
      page.request.post(url, { ...options, headers }),
    patch: (url: string, options?: { data?: unknown }): Promise<APIResponse> =>
      page.request.patch(url, { ...options, headers }),
    put: (url: string, options?: { data?: unknown }): Promise<APIResponse> =>
      page.request.put(url, { ...options, headers }),
    delete: (url: string): Promise<APIResponse> => page.request.delete(url, { headers }),
  };
}
