import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { NotePublishStatus, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';
import type { NoteFiltersState } from '../App';

const PUBLISH_STATUSES: readonly NotePublishStatus[] = ['draft', 'published', 'scheduled'];

interface NoteFiltersProps {
  tags: TagCountDto[];
  /** Category aggregate (N3) — candidates unaffected by the active filter. */
  categories: TagCountDto[];
  filters: NoteFiltersState;
  onChange: (filters: NoteFiltersState) => void;
}

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/**
 * Sidebar filters: tags (AND) / categories (OR) / publish status (OR) /
 * priorities (OR), dimensions ANDed together (Memo M2 pattern, N3 adds the
 * last two dimensions).
 */
export default function NoteFilters({ tags, categories, filters, onChange }: NoteFiltersProps) {
  const { t } = useTranslation();

  const active =
    filters.tags.length > 0 ||
    filters.priorities.length > 0 ||
    filters.categories.length > 0 ||
    filters.publishStatuses.length > 0;

  return (
    <div className="notes-filters">
      <h3 className="notes-filters__heading">{t('notes.filter.tags')}</h3>
      {tags.length === 0 ? (
        <p className="notes-filters__empty">{t('notes.filter.noTags')}</p>
      ) : (
        tags.map(({ tag, count }) => (
          <label key={tag} className="notes-filters__row">
            <input
              type="checkbox"
              checked={filters.tags.includes(tag)}
              onChange={() => onChange({ ...filters, tags: toggle(filters.tags, tag) })}
            />
            <span className="notes-filters__label">{tag}</span>
            <span className="notes-filters__count">{count}</span>
          </label>
        ))
      )}

      <h3 className="notes-filters__heading">{t('notes.filter.categories')}</h3>
      {categories.length === 0 ? (
        <p className="notes-filters__empty">{t('notes.filter.noCategories')}</p>
      ) : (
        categories.map(({ tag, count }) => (
          <label key={tag} className="notes-filters__row">
            <input
              type="checkbox"
              checked={filters.categories.includes(tag)}
              onChange={() => onChange({ ...filters, categories: toggle(filters.categories, tag) })}
            />
            <span className="notes-filters__label">{tag}</span>
            <span className="notes-filters__count">{count}</span>
          </label>
        ))
      )}

      <h3 className="notes-filters__heading">{t('notes.filter.status')}</h3>
      {PUBLISH_STATUSES.map((status) => (
        <label key={status} className="notes-filters__row">
          <input
            type="checkbox"
            checked={filters.publishStatuses.includes(status)}
            onChange={() =>
              onChange({ ...filters, publishStatuses: toggle(filters.publishStatuses, status) })
            }
          />
          <span className={`notes-filters__label notes-list__status--${status}`}>
            {t(`notes.filter.status.${status}`)}
          </span>
        </label>
      ))}

      <h3 className="notes-filters__heading">{t('notes.filter.priorities')}</h3>
      {MEMO_PRIORITIES.map((priority) => (
        <label key={priority} className="notes-filters__row">
          <input
            type="checkbox"
            checked={filters.priorities.includes(priority)}
            onChange={() => onChange({ ...filters, priorities: toggle(filters.priorities, priority) })}
          />
          <span className={`notes-filters__label memo-priority--${priority}`}>
            {t(`notes.priority.${priority}`)}
          </span>
        </label>
      ))}
      {active && (
        <Button
          size="sm"
          onClick={() =>
            onChange({ tags: [], priorities: [], categories: [], publishStatuses: [] })
          }
        >
          {t('notes.filter.clear')}
        </Button>
      )}
    </div>
  );
}
