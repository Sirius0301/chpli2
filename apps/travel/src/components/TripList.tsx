import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@chpli2/ui';
import type { TripDto, TripType } from '@chpli2/shared';
import { api, ApiError } from '../api';

const TRIP_IDS_KEY = 'chpli2-trip-ids';

function readTripIds(): string[] {
  try {
    const raw = localStorage.getItem(TRIP_IDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    /* corrupted storage; treat as empty */
  }
  return [];
}

function writeTripIds(ids: string[]): void {
  localStorage.setItem(TRIP_IDS_KEY, JSON.stringify(ids));
}

interface TripListProps {
  onOpen: (tripId: string) => void;
}

export default function TripList({ onOpen }: TripListProps) {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<TripDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TripType>('PLAN');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ids = readTripIds();
    const results = await Promise.all(
      ids.map((id) => api.getTrip(id).catch(() => null)),
    );
    const found = results.filter((trip): trip is TripDto => trip !== null);
    if (found.length !== ids.length) {
      writeTripIds(found.map((trip) => trip.id));
    }
    setTrips(found);
  }, []);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setLoadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
      setTrips([]);
    });
  }, [load]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const trip = await api.createTrip({ title: title.trim(), type });
      writeTripIds([...readTripIds(), trip.id]);
      setTitle('');
      setType('PLAN');
      await load();
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section>
      <h2>{t('trip.listTitle')}</h2>
      <form className="trip-create" onSubmit={(event) => void handleCreate(event)}>
        <h3>{t('trip.newTitle')}</h3>
        <label className="field">
          <span>{t('trip.titleLabel')}</span>
          <Input
            type="text"
            required
            value={title}
            placeholder={t('trip.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <fieldset className="type-select">
          <legend>{t('trip.typeLabel')}</legend>
          {(['PLAN', 'MEMORY'] as const).map((tripType) => (
            <label className="field field--checkbox" key={tripType}>
              <input
                type="radio"
                name="trip-type"
                checked={type === tripType}
                onChange={() => setType(tripType)}
              />
              <span>{t(`trip.type.${tripType}`)}</span>
            </label>
          ))}
        </fieldset>
        {createError && (
          <p className="form-error" role="alert">
            {t([`error.${createError}`, 'error.UNKNOWN'])}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={creating || !title.trim()}>
          {t(creating ? 'trip.creating' : 'trip.create')}
        </Button>
      </form>
      {loadError && (
        <p className="form-error" role="alert">
          {t([`error.${loadError}`, 'error.UNKNOWN'])}
        </p>
      )}
      {trips === null ? (
        <p className="loading">{t('common.loading')}</p>
      ) : trips.length === 0 ? (
        <p className="empty-hint">{t('trip.empty')}</p>
      ) : (
        <ul className="trip-list">
          {trips.map((trip) => (
            <li className="trip-card" key={trip.id}>
              <div className="trip-card__info">
                <span className="trip-card__title">{trip.title}</span>
                <span className={`badge badge--type badge--${trip.type.toLowerCase()}`}>
                  {t(`trip.type.${trip.type}`)}
                </span>
                <span className="trip-card__count">
                  {t('trip.transportCount', { count: trip.transports.length })}
                </span>
              </div>
              <Button size="sm" onClick={() => onOpen(trip.id)}>
                {t('trip.open')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
