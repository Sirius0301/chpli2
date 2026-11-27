import { useTranslation } from 'react-i18next';
import { Button, FilterRow } from '@chpli2/ui';
import type { NotePriority, NotePublishStatus, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';

const PUBLISH_STATUSES: readonly NotePublishStatus[] = ['draft', 'published', 'scheduled'];

export interface NoteFiltersState {
  tags: string[];
  priorities: NotePriority[];
  /** OR semantics (N3 sidebar filter). */
  categories: string[];
  /** OR semantics (N3 sidebar filter). */
  publishStatuses: NotePublishStatus[];
}

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
          <FilterRow
            key={tag}
            checked={filters.tags.includes(tag)}
            onToggle={() => onChange({ ...filters, tags: toggle(filters.tags, tag) })}
            label={tag}
            count={count}
          />
        ))
      )}

      <h3 className="notes-filters__heading">{t('notes.filter.categories')}</h3>
      {categories.length === 0 ? (
        <p className="notes-filters__empty">{t('notes.filter.noCategories')}</p>
      ) : (
        categories.map(({ tag, count }) => (
          <FilterRow
            key={tag}
            checked={filters.categories.includes(tag)}
            onToggle={() => onChange({ ...filters, categories: toggle(filters.categories, tag) })}
            label={tag}
            count={count}
          />
        ))
      )}

      <h3 className="notes-filters__heading">{t('notes.filter.status')}</h3>
      {PUBLISH_STATUSES.map((status) => (
        <FilterRow
          key={status}
          checked={filters.publishStatuses.includes(status)}
          onToggle={() =>
            onChange({ ...filters, publishStatuses: toggle(filters.publishStatuses, status) })
          }
          label={t(`notes.filter.status.${status}`)}
          labelClassName={`notes-list__status--${status}`}
        />
      ))}

      <h3 className="notes-filters__heading">{t('notes.filter.priorities')}</h3>
      {MEMO_PRIORITIES.map((priority) => (
        <FilterRow
          key={priority}
          checked={filters.priorities.includes(priority)}
          onToggle={() => onChange({ ...filters, priorities: toggle(filters.priorities, priority) })}
          label={t(`notes.priority.${priority}`)}
          labelClassName={`memo-priority--${priority}`}
        />
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
