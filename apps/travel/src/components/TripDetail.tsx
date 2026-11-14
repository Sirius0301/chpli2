import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { TransportDto, TripDto } from '@chpli2/shared';
import { api, ApiError } from '../api';
import ConfirmDialog from './ConfirmDialog';
import TransportForm from './TransportForm';
import TransportList from './TransportList';

interface TripDetailProps {
  tripId: string;
  onBack: () => void;
}

function errorCodeOf(error: unknown): string {
  return error instanceof ApiError ? error.errorCode : 'UNKNOWN';
}

export default function TripDetail({ tripId, onBack }: TripDetailProps) {
  const { t } = useTranslation();
  const [trip, setTrip] = useState<TripDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TransportDto | null>(null);
  const [deleting, setDeleting] = useState<TransportDto | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formNonce, setFormNonce] = useState(0);

  const load = useCallback(async () => {
    try {
      setTrip(await api.getTrip(tripId));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorCodeOf(error));
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = () => {
    setEditing(null);
    setFormNonce((n) => n + 1);
    void load();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setDeletingInProgress(true);
    setActionError(null);
    try {
      await api.deleteTransport(deleting.id);
      setDeleting(null);
      if (editing?.id === deleting.id) setEditing(null);
      void load();
    } catch (error) {
      setActionError(errorCodeOf(error));
    } finally {
      setDeletingInProgress(false);
    }
  };

  if (loadError) {
    return (
      <section>
        <p className="form-error" role="alert">
          {t([`error.${loadError}`, 'error.UNKNOWN'])}
        </p>
        <Button size="sm" onClick={onBack}>
          {t('trip.back')}
        </Button>
      </section>
    );
  }

  if (!trip) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  return (
    <section>
      <div className="trip-detail__header">
        <Button size="sm" onClick={onBack}>
          ← {t('trip.back')}
        </Button>
        <h2>{trip.title}</h2>
        <span className={`badge badge--type badge--${trip.type.toLowerCase()}`}>
          {t(`trip.type.${trip.type}`)}
        </span>
      </div>
      {actionError && (
        <p className="form-error" role="alert">
          {t([`error.${actionError}`, 'error.UNKNOWN'])}
        </p>
      )}
      <h3>{t('transport.title')}</h3>
      {trip.transports.length === 0 ? (
        <p className="empty-hint">{t('transport.empty')}</p>
      ) : (
        <TransportList
          transports={trip.transports}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}
      <TransportForm
        key={`${editing?.id ?? 'new'}:${formNonce}`}
        trip={trip}
        editing={editing}
        onSaved={handleSaved}
        onCancelEdit={() => setEditing(null)}
      />
      {deleting && (
        <ConfirmDialog
          title={t('transport.deleteTitle')}
          message={t('transport.deleteMessage')}
          confirmLabel={t('transport.confirmDelete')}
          cancelLabel={t('transport.cancelDelete')}
          busy={deletingInProgress}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
