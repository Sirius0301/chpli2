import { render, screen } from '@testing-library/react';
import i18n, { LANGUAGE_CHANGED_EVENT } from '../i18n';
import App from '../App';
import RemoteErrorBoundary from '../components/RemoteErrorBoundary';

const TEST_USER = { id: 'u1', username: 'tester', createdAt: '2026-01-01T00:00:00.000Z' };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Stubs the auth endpoints; remotes are mocked via __mocks__/remoteStub. */
function stubAuthApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return localStorage.getItem('chpli2-token')
          ? jsonResponse(TEST_USER)
          : jsonResponse(
              { statusCode: 401, message: 'unauthorized', errorCode: 'UNAUTHORIZED' },
              401,
            );
      }
      if (url.endsWith('/api/auth/login')) {
        return jsonResponse({ token: 'tok', user: TEST_USER });
      }
      if (url.endsWith('/api/auth/register')) {
        return jsonResponse({ token: 'tok', user: TEST_USER }, 201);
      }
      return jsonResponse({}, 404);
    }),
  );
}

function seedSession(): void {
  localStorage.setItem('chpli2-token', 'tok');
  localStorage.setItem('chpli2-user', JSON.stringify(TEST_USER));
}

beforeEach(async () => {
  localStorage.clear();
  stubAuthApi();
  await i18n.changeLanguage('zh-CN');
});

describe('Host shell', () => {
  it('renders navigation with selected state and switches language via event', async () => {
    seedSession();
    render(<App />);

    const travelNav = await screen.findByRole('button', { name: '行程' });
    expect(travelNav.className).toContain('nav-item');

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'en' } }),
    );
    expect(await screen.findByRole('button', { name: 'Travel' })).toBeTruthy();
    expect(screen.getByText('Welcome to CHPLI')).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: { language: 'de' } }),
    );
    expect(await screen.findByRole('button', { name: 'Reisen' })).toBeTruthy();
    expect(screen.getByText('Willkommen bei CHPLI')).toBeTruthy();
  });

  it('requires sign-in: shows the auth card without a session, login enters the shell', async () => {
    render(<App />);
    const card = await screen.findByRole('form', { name: '登录 CHPLI' });
    expect(card).toBeTruthy();

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText('用户名 / 邮箱 / 手机'), {
      target: { value: 'tester' },
    });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    // Authenticated: the navigation appears, token persisted (A19).
    expect(await screen.findByRole('button', { name: '行程' })).toBeTruthy();
    expect(localStorage.getItem('chpli2-token')).toBe('tok');

    // Logout returns to the auth card and clears the session.
    fireEvent.click(screen.getByRole('button', { name: '登出' }));
    expect(await screen.findByRole('form', { name: '登录 CHPLI' })).toBeTruthy();
    expect(localStorage.getItem('chpli2-token')).toBeNull();
  });

  it('persists the selected language and notifies other apps via event', async () => {
    seedSession();
    render(<App />);
    const eventSpy = vi.fn();
    window.addEventListener(LANGUAGE_CHANGED_EVENT, eventSpy);

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(await screen.findByLabelText('语言'), { target: { value: 'en' } });

    await screen.findByRole('button', { name: 'Travel' });
    expect(localStorage.getItem('chpli2-language')).toBe('en');
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(
      (eventSpy.mock.calls[0]![0] as CustomEvent<{ language: string }>).detail,
    ).toEqual({ language: 'en' });
    window.removeEventListener(LANGUAGE_CHANGED_EVENT, eventSpy);
  });
});

describe('RemoteErrorBoundary', () => {
  function BrokenChild(): never {
    throw new Error('remote module failed');
  }

  it('shows a friendly error with retry instead of the broken child', async () => {
    render(
      <RemoteErrorBoundary moduleKey="travel" moduleUrl="http://localhost:3001">
        <BrokenChild />
      </RemoteErrorBoundary>,
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('模块加载失败')).toBeTruthy();
    expect(screen.getByText(/localhost:3001/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    expect(screen.queryByText('remote module failed')).toBeNull();
  });

  it('recovers when retry is clicked and the child renders again', async () => {
    let shouldThrow = true;
    function FlakyChild() {
      if (shouldThrow) throw new Error('boom');
      return <p>remote content</p>;
    }

    render(
      <RemoteErrorBoundary moduleKey="calendar" moduleUrl="http://localhost:3002">
        <FlakyChild />
      </RemoteErrorBoundary>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();

    shouldThrow = false;
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('remote content')).toBeTruthy();
  });
});
