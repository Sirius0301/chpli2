import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { MemoPriority, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES } from '@chpli2/shared';
import { daysUntil } from '../due';
import type { NotificationSupport } from '../notifications';
import type { DisplayMemoInstance } from '../view-model';

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
  /** Uncompleted due-soon instances, oldest first (M4). */
  due: DisplayMemoInstance[];
  onOpenDue: (instance: DisplayMemoInstance) => void;
  notifySupport: NotificationSupport;
  onEnableNotify: () => void;
}

/** Filter sidebar with the due-soon card on top (M2 filters, M4 due card). */
export default function Sidebar({
  tags,
  filters,
  onChange,
  due,
  onOpenDue,
  notifySupport,
  onEnableNotify,
}: SidebarProps) {
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

  const dueLabel = (instance: DisplayMemoInstance): string => {
    const days = daysUntil(instance.date, new Date().toISOString().slice(0, 10));
    if (days < 0) return t('memo.due.overdue');
    if (days === 0) return t('memo.due.today');
    return t('memo.due.inDays', { count: days });
  };

  return (
    <aside className="memo-sidebar">
      <div className="memo-sidebar__section memo-due" data-testid="due-card">
        <h3 className="memo-sidebar__heading">{t('memo.due.title')}</h3>
        {due.length === 0 ? (
          <p className="memo-sidebar__empty">{t('memo.due.empty')}</p>
        ) : (
          due.map((instance) => (
            <button
              key={instance.key}
              type="button"
              className="memo-due__item"
              data-due-key={instance.key}
              onClick={() => onOpenDue(instance)}
            >
              <span className={`memo-due__dot memo-priority--${instance.priority}`} />
              <span className="memo-due__body">
                <span className="memo-due__title">{instance.title}</span>
                <span className="memo-due__meta">{dueLabel(instance)}</span>
              </span>
            </button>
          ))
        )}
        {notifySupport === 'default' && (
          <Button size="sm" className="memo-due__enable" onClick={onEnableNotify}>
            {t('memo.notifyEnable')}
          </Button>
        )}
      </div>

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
        <Button
          size="sm"
          className="memo-sidebar__clear"
          onClick={() => onChange({ tags: [], priorities: [] })}
        >
          {t('memo.filter.clear')}
        </Button>
      )}
    </aside>
  );
}
