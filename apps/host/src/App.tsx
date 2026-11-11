import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
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

export default function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('home');
  const [tripId, setTripId] = useState<string | undefined>(undefined);
  const [auth, setAuth] = useState<AuthState>({ user: undefined });

  // Validate the stored token on first load (A19: refresh keeps the session).
  useEffect(() => {
    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
      setAuth({ user: null });
      return;
    }
    void fetchMe().then((user) => setAuth({ user: user ?? null }));
  }, []);

  // Any remote answering 401 drops the whole shell back to the login card.
  useEffect(() => {
    const handleUnauthorized = () => setAuth({ user: null });
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setAuth({ user: null });
    setView('home');
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

  if (auth.user === undefined) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  if (auth.user === null) {
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
