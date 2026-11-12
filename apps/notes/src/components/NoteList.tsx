import { useTranslation } from 'react-i18next';
import type { NoteDto } from '@chpli2/shared';

interface NoteListProps {
  notes: NoteDto[];
  selectedId: string | null;
  onSelect: (note: NoteDto) => void;
}

/** Notes list, most recently updated first. */
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
            <span className="notes-list__title">{note.title}</span>
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
