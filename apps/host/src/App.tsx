import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
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
import HomeNotes from './components/HomeNotes';
import { quoteForDate } from './data/daily-quotes';
import { createPortalBridge, type PortalBridge, type PortalMode } from './portal/bridge';

const TravelApp = lazy(() => import('travel/App'));
const CalendarApp = lazy(() => import('calendar/App'));
const NotesApp = lazy(() => import('notes/App'));
const BookmarksApp = lazy(() => import('bookmarks/App'));
const GrowthApp = lazy(() => import('growth/App'));
const LifeFolderApp = lazy(() => import('lifefolder/App'));

const REMOTE_URLS: Record<string, string> = {
  travel: 'http://localhost:3001',
  calendar: 'http://localhost:3002',
  notes: 'http://localhost:3003',
  bookmarks: 'http://localhost:3004',
  growth: 'http://localhost:3005',
  lifefolder: 'http://localhost:3006',
};

type View = 'home' | 'travel' | 'calendar' | 'notes' | 'bookmarks' | 'growth' | 'lifefolder';

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

const SIDEBAR_COLLAPSED_KEY = 'chpli2-sidebar-collapsed';

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Daily English quote (deterministic by calendar day, host-local data). */
function DailyQuote() {
  const quote = quoteForDate(new Date());
  return (
    <div className="daily-quote" data-testid="daily-quote">
      <span className="daily-quote__en">{quote.en}</span>
      <span className="daily-quote__zh">{quote.zh}</span>
    </div>
  );
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable: toggle lives for the session only */
      }
      return next;
    });
  }, []);

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

  // Cross-module navigation requested by remotes (e.g. opening a goal link).
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const target = (event as CustomEvent<{ view?: View }>).detail?.view;
      if (target && target !== 'home') {
        setTripId(undefined);
        setView(target);
      }
    };
    window.addEventListener('chpli2-navigate', handleNavigate);
    return () => window.removeEventListener('chpli2-navigate', handleNavigate);
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
    <div className={sidebarCollapsed ? 'shell shell--collapsed' : 'shell'}>
      <div className="shell__body">
        <aside className="sidebar" aria-hidden={sidebarCollapsed}>
          <div className="sidebar__brand">
            <img src="/favicon-96x96.png" alt="" />
            <span>CHPLI</span>
          </div>
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
            <button
              type="button"
              className={view === 'notes' ? 'nav-item nav-item--active' : 'nav-item'}
              onClick={() => selectView('notes')}
            >
              {t('nav.notes')}
            </button>
            <button
              type="button"
              className={view === 'bookmarks' ? 'nav-item nav-item--active' : 'nav-item'}
              onClick={() => selectView('bookmarks')}
            >
              {t('nav.bookmarks')}
            </button>
            <button
              type="button"
              className={view === 'growth' ? 'nav-item nav-item--active' : 'nav-item'}
              onClick={() => selectView('growth')}
            >
              {t('nav.growth')}
            </button>
            <button
              type="button"
              className={view === 'lifefolder' ? 'nav-item nav-item--active' : 'nav-item'}
              onClick={() => selectView('lifefolder')}
            >
              {t('nav.lifefolder')}
            </button>
          </nav>
        </aside>
        <div className="main">
          <header className="topbar">
            <Button
              variant="text"
              size="sm"
              className="topbar__toggle"
              aria-label={t(sidebarCollapsed ? 'sidebar.expand' : 'sidebar.collapse')}
              aria-expanded={!sidebarCollapsed}
              onClick={toggleSidebar}
            >
              ☰
            </Button>
            <DailyQuote />
            <span className="topbar__brand">
              <img src="/favicon-96x96.png" alt="" />
              <span>CHPLI</span>
            </span>
            <span className="topbar__spacer" />
            <span className="topbar__user">
              {t('auth.welcome', { username: auth.user.username })}
            </span>
            <LanguageSwitcher />
            {portalMode === 'portal' && (
              <Button size="sm" onClick={() => bridgeRef.current?.goHome()}>
                {t('portal.backHome')}
              </Button>
            )}
            <Button size="sm" onClick={logout}>
              {t('auth.logout')}
            </Button>
          </header>
          <main className="content">
            {view === 'home' && (
              <section className="home">
                <div className="home__hero">
                  <div className="home__hero-title">
                    <img className="home__logo" src="/web-app-manifest-192x192.png" alt="CHPLI" />
                    <h1>{t('home.welcome')}</h1>
                  </div>
                  <p className="home__hero-hint">{t('home.hint')}</p>
                  <div className="home__hero-values">
                    <h2 className="home__hero-values-title">{t('home.valuesTitle')}</h2>
                    <div className="home__value-row">
                      {(
                        ['confidence', 'honesty', 'politeness', 'learning', 'iteration'] as const
                      ).map((key, index) => (
                        <div className="home__value-card" key={key}>
                          <span className="home__value-letter" aria-hidden>
                            {'CHPLI'[index]}
                          </span>
                          <span className="home__value-name">{t(`home.values.${key}.name`)}</span>
                          <span className="home__value-desc">{t(`home.values.${key}.desc`)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="home__section">
                  <h2 className="home__section-title">{t('home.modulesTitle')}</h2>
                  <div className="home__module-row">
                    {(
                      ['calendar', 'travel', 'notes', 'bookmarks', 'growth', 'lifefolder'] as const
                    ).map((module) => (
                      <button
                        type="button"
                        className="home__module-card"
                        key={module}
                        onClick={() => selectView(module)}
                      >
                        <span className="home__module-name">{t(`nav.${module}`)}</span>
                        <span className="home__module-desc">{t(`home.modules.${module}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <HomeNotes />
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
                  {view === 'notes' && <NotesApp />}
                  {view === 'bookmarks' && <BookmarksApp />}
                  {view === 'growth' && <GrowthApp />}
                  {view === 'lifefolder' && <LifeFolderApp />}
                </Suspense>
              </RemoteErrorBoundary>
            )}
          </main>
        </div>
      </div>
      <footer className="footer">{t('footer.line', { year: new Date().getFullYear() })}</footer>
    </div>
  );
}
