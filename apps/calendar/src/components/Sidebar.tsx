import { useTranslation } from 'react-i18next';
import type { MemoPriority, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';

export interface MemoFilters {
  /** AND semantics across selected tags (M2). */
  tags: string[];
  /** OR semantics across selected priorities (M2). */
  priorities: MemoPriority[];
}

interface SidebarProps {
  tags: TagCountDto[];
  filters: MemoFilters;
  onChange: (filters: MemoFilters) => void;
}

/** Filter sidebar: two-level filtering — tags AND, priorities OR (M2). */
export default function Sidebar({ tags, filters, onChange }: SidebarProps) {
  const { t } = useTranslation();

  const toggleTag = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((x) => x !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  };

  const togglePriority = (priority: MemoPriority) => {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((x) => x !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: next });
  };

  const active = filters.tags.length > 0 || filters.priorities.length > 0;

  return (
    <aside className="memo-sidebar">
      <div className="memo-sidebar__section">
        <h3 className="memo-sidebar__heading">{t('memo.filter.tags')}</h3>
        {tags.length === 0 ? (
          <p className="memo-sidebar__empty">{t('memo.filter.noTags')}</p>
        ) : (
          tags.map(({ tag, count }) => (
            <label key={tag} className="memo-sidebar__row">
              <input
                type="checkbox"
                checked={filters.tags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              <span className="memo-sidebar__label">{tag}</span>
              <span className="memo-sidebar__count">{count}</span>
            </label>
          ))
        )}
      </div>

      <div className="memo-sidebar__section">
        <h3 className="memo-sidebar__heading">{t('memo.filter.priorities')}</h3>
        {MEMO_PRIORITIES.map((priority) => (
          <label key={priority} className="memo-sidebar__row">
            <input
              type="checkbox"
              checked={filters.priorities.includes(priority)}
              onChange={() => togglePriority(priority)}
            />
            <span className={`memo-sidebar__label memo-priority--${priority}`}>
              {t(`memo.priority.${priority}`)}
            </span>
          </label>
        ))}
      </div>

      {active && (
        <button
          type="button"
          className="button memo-sidebar__clear"
          onClick={() => onChange({ tags: [], priorities: [] })}
        >
          {t('memo.filter.clear')}
        </button>
      )}
    </aside>
  );
}
