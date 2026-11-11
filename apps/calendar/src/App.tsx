import './i18n';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarEventDto } from '@chpli2/shared';
import { ApiError, formatDateTime, listEvents } from './api';

/** Notifies the host app to switch to the Travel module and open this trip. */
export const OPEN_TRIP_EVENT = 'chpli2-open-trip';

function monthKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function CalendarApp() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<CalendarEventDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setEvents(await listEvents());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.errorCode : 'UNKNOWN');
      setEvents([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const sorted = [...(events ?? [])].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
    const map = new Map<string, CalendarEventDto[]>();
    for (const event of sorted) {
      const key = monthKey(event.startsAt);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return [...map.entries()];
  }, [events]);

  const openTrip = (event: CalendarEventDto) => {
    window.dispatchEvent(
      new CustomEvent(OPEN_TRIP_EVENT, {
        detail: { tripId: event.source.tripId },
      }),
    );
  };

  return (
    <section>
      <h2>{t('calendar.title')}</h2>
      <p className="hint">{t('calendar.clickHint')}</p>
      {error && (
        <div className="calendar-error" role="alert">
          <p>{t([`error.${error}`, 'error.UNKNOWN'])}</p>
          <button type="button" className="button" onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {events === null ? (
        <p className="loading">{t('common.loading')}</p>
      ) : events.length === 0 && !error ? (
        <p className="empty-hint">{t('calendar.empty')}</p>
      ) : (
        groups.map(([key, monthEvents]) => (
          <div className="month-group" key={key}>
            <h3 className="month-group__heading">
              {new Date(monthEvents[0]!.startsAt).toLocaleString(i18n.language, {
                year: 'numeric',
                month: 'long',
              })}
            </h3>
            <ul className="event-list">
              {monthEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className="event-item"
                    onClick={() => openTrip(event)}
                  >
                    <span className="event-item__title">{event.title}</span>
                    <span className="event-item__time">
                      {formatDateTime(event.startsAt, i18n.language)}
                      {' – '}
                      {formatDateTime(event.endsAt, i18n.language)}
                    </span>
                    <span className="badge badge--source">
                      {t('calendar.source.travel')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
