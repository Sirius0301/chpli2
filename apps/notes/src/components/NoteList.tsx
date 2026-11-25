import { useTranslation } from 'react-i18next';
import type { NoteDto } from '@chpli2/shared';

interface NoteListProps {
  notes: NoteDto[];
  selectedId: string | null;
  onSelect: (note: NoteDto) => void;
}

/** Pin marker: small SVG flag, no emoji. */
function PinIcon() {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="currentColor" aria-hidden>
      <path d="M8.5 1.5 10.5 3.5 9 4l1 3-1.5 1.5L6 4.5 4 6.5l-.5-3L1.5 2 2 1l4.5 1z" transform="rotate(15 6 6)" />
    </svg>
  );
}

/** Notes list: pinned first (backend ordering), publish status badges (N3). */
export default function NoteList({ notes, selectedId, onSelect }: NoteListProps) {
  const { t, i18n } = useTranslation();
  if (notes.length === 0) {
    return <p className="notes-list__empty">{t('notes.empty')}</p>;
  }
  return (
    <ul className="notes-list">
      {notes.map((note) => (
        <li key={note.id}>
          <button
            type="button"
            className={note.id === selectedId ? 'notes-list__item notes-list__item--active' : 'notes-list__item'}
            onClick={() => onSelect(note)}
          >
            <span className={`notes-list__dot memo-priority--${note.priority}`} />
            <span className="notes-list__main">
              <span className="notes-list__title">
                {note.pinned && (
                  <span className="notes-list__pin" title={t('notes.list.pinned')} aria-label={t('notes.list.pinned')}>
                    <PinIcon />
                  </span>
                )}
                {note.title}
              </span>
              {note.publishStatus !== 'draft' && (
                <span
                  className={`notes-list__status notes-list__status--${note.publishStatus}`}
                >
                  {note.publishStatus === 'published'
                    ? t('notes.list.published')
                    : t('notes.list.scheduled')}
                </span>
              )}
            </span>
            <span className="notes-list__meta">
              {new Date(note.updatedAt).toLocaleString(i18n.language, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
