import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { NotePriority, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';
import type { NoteFiltersState } from '../App';

interface NoteFiltersProps {
  tags: TagCountDto[];
  filters: NoteFiltersState;
  onChange: (filters: NoteFiltersState) => void;
}

/** Two-level filtering: tags AND / priorities OR (Memo M2 pattern). */
export default function NoteFilters({ tags, filters, onChange }: NoteFiltersProps) {
  const { t } = useTranslation();

  const toggleTag = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((x) => x !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  };

  const togglePriority = (priority: NotePriority) => {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((x) => x !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: next });
  };

  const active = filters.tags.length > 0 || filters.priorities.length > 0;

  return (
    <div className="notes-filters">
      <h3 className="notes-filters__heading">{t('notes.filter.tags')}</h3>
      {tags.length === 0 ? (
        <p className="notes-filters__empty">{t('notes.filter.noTags')}</p>
      ) : (
        tags.map(({ tag, count }) => (
          <label key={tag} className="notes-filters__row">
            <input type="checkbox" checked={filters.tags.includes(tag)} onChange={() => toggleTag(tag)} />
            <span className="notes-filters__label">{tag}</span>
            <span className="notes-filters__count">{count}</span>
          </label>
        ))
      )}
      <h3 className="notes-filters__heading">{t('notes.filter.priorities')}</h3>
      {MEMO_PRIORITIES.map((priority) => (
        <label key={priority} className="notes-filters__row">
          <input
            type="checkbox"
            checked={filters.priorities.includes(priority)}
            onChange={() => togglePriority(priority)}
          />
          <span className={`notes-filters__label memo-priority--${priority}`}>
            {t(`notes.priority.${priority}`)}
          </span>
        </label>
      ))}
      {active && (
        <Button size="sm" onClick={() => onChange({ tags: [], priorities: [] })}>
          {t('notes.filter.clear')}
        </Button>
      )}
    </div>
  );
}
