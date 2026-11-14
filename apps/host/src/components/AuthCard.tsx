import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@chpli2/ui';
import type { ApiErrorBody, AuthResponseDto, SendCodeResponseDto } from '@chpli2/shared';
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  authFetchHeaders,
} from '@chpli2/shared';
import type { UserDto } from '@chpli2/shared';

interface AuthCardProps {
  /** Called with the authenticated user after login or registration. */
  onAuthenticated: (user: UserDto) => void;
}

async function postAuth(
  endpoint: 'login' | 'register' | 'code' | 'login-code',
  payload: Record<string, string>,
): Promise<AuthResponseDto & Partial<SendCodeResponseDto>> {
  const response = await fetch(`/api/auth/${endpoint}`, {
    method: 'POST',
    headers: authFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<ApiErrorBody> &
    Partial<AuthResponseDto> &
    Partial<SendCodeResponseDto>;
  if (!response.ok) {
    const error = new Error(body.message ?? `HTTP ${response.status}`) as Error & {
      errorCode?: string;
    };
    error.errorCode = body.errorCode;
    throw error;
  }
  return body as AuthResponseDto & Partial<SendCodeResponseDto>;
}

/** Login / registration card shown until the user is authenticated (M0 + 增强). */
export default function AuthCard({ onAuthenticated }: AuthCardProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginMode, setLoginMode] = useState<'password' | 'code'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (cooldownUntil === null || cooldownUntil <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil, now]);

  const cooldownLeft = cooldownUntil !== null ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  const fail = (authError: unknown) => {
    const codeErr =
      authError instanceof Error ? (authError as { errorCode?: string }).errorCode : undefined;
    setError(t([`auth.error.${codeErr ?? ''}`, 'auth.error.UNKNOWN']));
    setBusy(false);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result =
        mode === 'register'
          ? await postAuth('register', {
              username: identifier.trim(),
              password,
              ...(email.trim() ? { email: email.trim() } : {}),
              ...(phone.trim() ? { phone: phone.trim() } : {}),
            })
          : loginMode === 'password'
            ? await postAuth('login', { identifier: identifier.trim(), password })
            : await postAuth('login-code', { identifier: identifier.trim(), code: code.trim() });
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(result.user));
      onAuthenticated(result.user);
    } catch (authError) {
      fail(authError);
    }
  };

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await postAuth('code', { identifier: identifier.trim() });
      if (!result.sent) {
        // E42: do not reveal whether the identifier is registered.
        setNotice(t('auth.codeMaybeSent'));
      } else {
        setNotice(t('auth.codeSent'));
        setCooldownUntil(Date.now() + 60 * 1000);
        setNow(Date.now());
      }
    } catch (authError) {
      fail(authError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form
        className="auth__card"
        aria-label={t('auth.title')}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className="auth__heading">{t('auth.title')}</h1>
        <div className="auth__tabs" role="tablist">
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              className={mode === tab ? 'auth__tab auth__tab--active' : 'auth__tab'}
              onClick={() => {
                setMode(tab);
                setError(null);
                setNotice(null);
              }}
            >
              {t(tab === 'login' ? 'auth.loginTab' : 'auth.registerTab')}
            </button>
          ))}
        </div>
        {mode === 'login' && (
          <div className="auth__tabs" role="tablist" aria-label={t('auth.loginModeLabel')}>
            {(['password', 'code'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={loginMode === tab}
                className={
                  loginMode === tab ? 'auth__tab auth__tab--active' : 'auth__tab'
                }
                onClick={() => {
                  setLoginMode(tab);
                  setError(null);
                  setNotice(null);
                }}
              >
                {t(tab === 'password' ? 'auth.loginModePassword' : 'auth.loginModeCode')}
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="auth__error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="auth__notice" role="status">
            {notice}
          </div>
        )}
        <label className="auth__row">
          <span>{t(mode === 'login' ? 'auth.identifier' : 'auth.username')}</span>
          <Input
            type="text"
            value={identifier}
            autoComplete="username"
            onChange={(event) => setIdentifier(event.target.value)}
            disabled={busy}
            required
            minLength={3}
            maxLength={mode === 'login' ? 64 : 32}
          />
        </label>
        {mode === 'register' && (
          <>
            <label className="auth__row">
              <span>{t('auth.email')}</span>
              <Input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="auth__row">
              <span>{t('auth.phone')}</span>
              <Input
                type="tel"
                value={phone}
                autoComplete="tel"
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
              />
            </label>
          </>
        )}
        {mode === 'register' || loginMode === 'password' ? (
          <label className="auth__row">
            <span>{t('auth.password')}</span>
            <Input
              type="password"
              value={password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
              minLength={8}
              maxLength={128}
            />
          </label>
        ) : (
          <>
            <label className="auth__row">
              <span>{t('auth.code')}</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                autoComplete="one-time-code"
                onChange={(event) => setCode(event.target.value)}
                disabled={busy}
                required
                minLength={6}
                maxLength={6}
              />
            </label>
            <Button
              variant="default"
              block
              disabled={busy || !identifier.trim() || cooldownLeft > 0}
              onClick={() => void sendCode()}
            >
              {cooldownLeft > 0
                ? t('auth.resendAfter', { seconds: cooldownLeft })
                : t('auth.sendCode')}
            </Button>
          </>
        )}
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy
            ? t('auth.loggingIn')
            : t(mode === 'login' ? 'auth.submitLogin' : 'auth.submitRegister')}
        </Button>
      </form>
    </div>
  );
}
