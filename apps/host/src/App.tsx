import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import RemoteErrorBoundary from './components/RemoteErrorBoundary';

const TravelApp = lazy(() => import('travel/App'));
const CalendarApp = lazy(() => import('calendar/App'));

const REMOTE_URLS: Record<string, string> = {
  travel: 'http://localhost:3001',
  calendar: 'http://localhost:3002',
};

type View = 'home' | 'travel' | 'calendar';

export default function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('home');
  const [tripId, setTripId] = useState<string | undefined>(undefined);

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
          <LanguageSwitcher />
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
