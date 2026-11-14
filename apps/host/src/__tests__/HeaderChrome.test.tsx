import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '../i18n';
import { quoteForDate, DAILY_QUOTES } from '../data/daily-quotes';

describe('quoteForDate', () => {
  it('is deterministic for the same day and cycles the full list', () => {
    const d1 = new Date(2026, 10, 14, 8, 0, 0);
    const d2 = new Date(2026, 10, 14, 23, 59, 59);
    expect(quoteForDate(d1)).toEqual(quoteForDate(d2));
    // Different days pick different entries (list length > 1 guarantees variety over time).
    const picks = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const d = new Date(2026, 0, 1 + i);
        return quoteForDate(d).en;
      }),
    );
    expect(picks.size).toBeGreaterThan(1);
    expect(DAILY_QUOTES.every((q) => q.en && q.zh)).toBe(true);
  });
});

describe('header chrome', () => {
  it('toggles the sidebar, persists the preference and shows the daily quote', async () => {
    i18n.changeLanguage('zh-CN');
    localStorage.clear();
    const TEST_USER = { id: 'u1', username: 'tester', createdAt: '2026-01-01T00:00:00.000Z' };
    localStorage.setItem('chpli2-token', 'tok');
    localStorage.setItem('chpli2-user', JSON.stringify(TEST_USER));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) {
          return new Response(JSON.stringify(TEST_USER), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{}', { status: 200 });
      }),
    );

    const App = (await import('../App')).default;
    render(<App />);

    // Sidebar visible initially (wait for auth validation + portal handshake).
    await screen.findByRole('button', { name: '收起菜单' });
    const shell = document.querySelector('.shell')!;
    expect(shell.className).not.toContain('shell--collapsed');

    // Daily quote renders on the home page with English line and translation.
    const quote = screen.getByTestId('daily-quote');
    const expected = quoteForDate(new Date());
    expect(quote.textContent).toContain(expected.en);
    expect(quote.textContent).toContain(expected.zh);

    // Header shows brand logo + text; one-line footer shows copyright + author.
    expect(screen.getByAltText('CHPLI')).toBeTruthy();
    expect(screen.getByText('© 2026 CHPLI · 作者 Shimin')).toBeTruthy();

    // Toggle collapses, aria state updates, preference persists.
    fireEvent.click(screen.getByRole('button', { name: '收起菜单' }));
    expect(document.querySelector('.shell')!.className).toContain('shell--collapsed');
    expect(localStorage.getItem('chpli2-sidebar-collapsed')).toBe('1');
    expect(screen.getByRole('button', { name: '展开菜单' })).toBeTruthy();

    // Toggle again restores.
    fireEvent.click(screen.getByRole('button', { name: '展开菜单' }));
    expect(document.querySelector('.shell')!.className).not.toContain('shell--collapsed');
    expect(localStorage.getItem('chpli2-sidebar-collapsed')).toBe('0');
    vi.unstubAllGlobals();
  });
});
