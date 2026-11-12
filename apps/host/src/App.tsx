import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserDto } from '@chpli2/shared';
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  UNAUTHORIZED_EVENT,
  authFetchHeaders,
} from '@chpli2/shared';
import LanguageSwitcher from './components/LanguageSwitcher';
import RemoteErrorBoundary from './components/RemoteErrorBoundary';
import AuthCard from './components/AuthCard';
import { createPortalBridge, type PortalBridge, type PortalMode } from './portal/bridge';

const TravelApp = lazy(() => import('travel/App'));
const CalendarApp = lazy(() => import('calendar/App'));

const REMOTE_URLS: Record<string, string> = {
  travel: 'http://localhost:3001',
  calendar: 'http://localhost:3002',
};

type View = 'home' | 'travel' | 'calendar';

/** null = signed out; undefined = still validating the stored token. */
type AuthState = { user: UserDto | null | undefined };

function readStoredUser(): UserDto | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserDto) : null;
  } catch {
    return null;
  }
}

async function fetchMe(): Promise<UserDto | null> {
  try {
    const response = await fetch('/api/auth/me', { headers: authFetchHeaders() });
    if (!response.ok) return null;
    return (await response.json()) as UserDto;
  } catch {
    return null;
  }
}

function clearStoredSession(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export default function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('home');
  const [tripId, setTripId] = useState<string | undefined>(undefined);
  const [auth, setAuth] = useState<AuthState>({ user: undefined });

  // M5 Portal integration: bridge to the Portal shell when embedded.
  const bridgeRef = useRef<PortalBridge | null>(null);
  const [portalMode, setPortalMode] = useState<PortalMode | 'unknown'>('unknown');

  useEffect(() => {
    const bridge = createPortalBridge(window, {
      onInit(message) {
        // Trust but verify (M5 D4): store the granted token, then validate
        // it against the API (fetchMe returns the full UserDto) before
        // entering the app.
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, message.token);
        setAuth({ user: undefined });
        void fetchMe().then((user) => {
          if (!user) {
            clearStoredSession();
            setAuth({ user: null });
            bridge.requestLogin();
          } else {
            setAuth({ user });
          }
        });
      },
      onPortalLogout() {
        clearStoredSession();
        setAuth({ user: null });
      },
    });
    bridgeRef.current = bridge;
    void bridge.ready.then((mode) => setPortalMode(mode));
    return () => {
      bridgeRef.current = null;
    };
  }, []);

  // Validate the stored token on first load (A19: refresh keeps the session).
  useEffect(() => {
    if (portalMode === 'unknown') return;
    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
      setAuth({ user: null });
      return;
    }
    void fetchMe().then((user) => setAuth({ user: user ?? null }));
  }, [portalMode]);

  // Any remote answering 401 drops the shell back to the login surface:
  // standalone renders the local card; Portal mode asks the Portal to log in.
  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      setAuth({ user: null });
      bridgeRef.current?.requestLogin();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const logout = useCallback(() => {
    const bridge = bridgeRef.current;
    clearStoredSession();
    setAuth({ user: null });
    setView('home');
    if (bridge?.mode === 'portal') {
      // M5 D5: the Portal owns the session; we announce and wait.
      bridge.notifyLogout();
    }
  }, []);

  useEffect(() => {
    const handleOpenTrip = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: string }>).detail;
      setTripId(detail?.tripId);
      setView('travel');
    };
    window.addEventListener('chpli2-open-trip', handleOpenTrip);
    return () => window.removeEventListener('chpli2-open-trip', handleOpenTrip);
  }, []);

  const selectView = (next: View) => {
    setTripId(undefined);
    setView(next);
  };

  if (auth.user === undefined || portalMode === 'unknown') {
    return <p className="loading">{t('common.loading')}</p>;
  }

  if (auth.user === null) {
    // Portal mode never renders the local login card (M5 D4/E73): the
    // Portal drives authentication after we ask it to.
    if (portalMode === 'portal') {
      return (
        <main className="portal-waiting">
          <p>{t('portal.waitingLogin')}</p>
        </main>
      );
    }
    return <AuthCard onAuthenticated={(user) => setAuth({ user })} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">CHPLI</div>
        <nav className="sidebar__nav">
          <button
            type="button"
            className={view === 'home' ? 'nav-item nav-item--active' : 'nav-item'}
            onClick={() => selectView('home')}
          >
            {t('nav.home')}
          </button>
          <button
            type="button"
            className={view === 'travel' ? 'nav-item nav-item--active' : 'nav-item'}
            onClick={() => selectView('travel')}
          >
            {t('nav.travel')}
          </button>
          <button
            type="button"
            className={view === 'calendar' ? 'nav-item nav-item--active' : 'nav-item'}
            onClick={() => selectView('calendar')}
          >
            {t('nav.calendar')}
          </button>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="topbar__brand">CHPLI</span>
          <span className="topbar__user">{t('auth.welcome', { username: auth.user.username })}</span>
          <LanguageSwitcher />
          {portalMode === 'portal' && (
            <button
              type="button"
              className="topbar__home"
              onClick={() => bridgeRef.current?.goHome()}
            >
              {t('portal.backHome')}
            </button>
          )}
          <button type="button" className="topbar__logout" onClick={logout}>
            {t('auth.logout')}
          </button>
        </header>
        <main className="content">
          {view === 'home' && (
            <section className="home">
              <h1>{t('home.welcome')}</h1>
              <p>{t('home.hint')}</p>
            </section>
          )}
          {view !== 'home' && (
            <RemoteErrorBoundary
              key={`${view}:${tripId ?? ''}`}
              moduleKey={view}
              moduleUrl={REMOTE_URLS[view] ?? ''}
            >
              <Suspense fallback={<p className="loading">{t('common.loading')}</p>}>
                {view === 'travel' && <TravelApp initialTripId={tripId} />}
                {view === 'calendar' && <CalendarApp />}
              </Suspense>
            </RemoteErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
