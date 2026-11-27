import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Loading, OverflowTooltip } from '@chpli2/ui';
import { noteExcerpt, type NoteDto } from '@chpli2/shared';

interface DayNotesProps {
  date: Date;
  notes: NoteDto[] | null;
  error: string | null;
  onOpen: (noteId: string) => void;
  onRetry: () => void;
}

/** Day-view rail: notes created during the selected local day. */
export default function DayNotes({ date, notes, error, onOpen, onRetry }: DayNotesProps) {
  const { t, i18n } = useTranslation();

  const sorted = useMemo(
    () => [...(notes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes],
  );

  const dayLabel = date.toLocaleDateString(i18n.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <aside className="day-notes" data-testid="day-notes" aria-label={t('memo.dayNotes.title')}>
      <div className="day-notes__head">
        <div className="day-notes__heading">
          <h3>{t('memo.dayNotes.title')}</h3>
          <span className="day-notes__date">{dayLabel}</span>
        </div>
        <span className="day-notes__count">{sorted.length}</span>
      </div>

      {error ? (
        <Alert
          tone="danger"
          action={
            <Button size="sm" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          }
        >
          <p>{t([`error.${error}`, 'error.UNKNOWN'])}</p>
        </Alert>
      ) : notes === null ? (
        <Loading label={t('common.loading')} />
      ) : sorted.length === 0 ? (
        <p className="day-notes__empty">{t('memo.dayNotes.empty')}</p>
      ) : (
        <ul className="day-notes__list">
          {sorted.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className="day-notes__item"
                onClick={() => onOpen(note.id)}
              >
                <OverflowTooltip text={note.title} className="day-notes__title" />
                <span className="day-notes__meta">
                  {note.category && <span className="day-notes__chip">{note.category}</span>}
                  <time>
                    {new Date(note.createdAt).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </span>
                <span className="day-notes__excerpt">{noteExcerpt(note.body, 80) || '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
