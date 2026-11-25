import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';
import type { MemoPriority, TagCountDto } from '@chpli2/shared';
import { MEMO_PRIORITIES, MEMO_TAG_MAX_LENGTH } from '@chpli2/shared';
import { daysUntil } from '../due';
import { dayKey } from '../dates';
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
  /** Renames a tag across all memos (sidebar tag management). */
  onRenameTag: (from: string, to: string) => Promise<void>;
  /** Removes a tag from all memos. */
  onDeleteTag: (tag: string) => Promise<void>;
}

/** One tag row: filter checkbox + inline rename + two-click delete. */
function TagRow({
  tag,
  count,
  checked,
  onToggle,
  onRename,
  onDelete,
}: {
  tag: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  onRename: (to: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const submitRename = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === tag || next.length > MEMO_TAG_MAX_LENGTH) return;
    setBusy(true);
    try {
      await onRename(next);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="memo-sidebar__row memo-sidebar__row--editing">
        <input
          type="text"
          className="memo-sidebar__edit-input"
          value={draft}
          maxLength={MEMO_TAG_MAX_LENGTH}
          autoFocus
          aria-label={t('memo.tagRename', { tag })}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitRename();
            if (event.key === 'Escape') setEditing(false);
          }}
          onBlur={() => void submitRename()}
        />
      </div>
    );
  }

  return (
    <div className="memo-sidebar__row" data-tag={tag}>
      <label className="memo-sidebar__row-main">
        <input type="checkbox" checked={checked} onChange={onToggle} disabled={busy} />
        <span className="memo-sidebar__label">{tag}</span>
        <span className="memo-sidebar__count">{count}</span>
      </label>
      <button
        type="button"
        className="memo-sidebar__tag-action"
        title={t('memo.tagRename', { tag })}
        aria-label={t('memo.tagRename', { tag })}
        disabled={busy}
        onClick={() => {
          setDraft(tag);
          setEditing(true);
        }}
      >
        ✎
      </button>
      <button
        type="button"
        className={
          confirmingDelete
            ? 'memo-sidebar__tag-action memo-sidebar__tag-action--confirm'
            : 'memo-sidebar__tag-action'
        }
        title={confirmingDelete ? t('memo.tagDeleteConfirm') : t('memo.tagDelete', { tag })}
        aria-label={t('memo.tagDelete', { tag })}
        disabled={busy}
        onClick={() => void handleDelete()}
        onBlur={() => setConfirmingDelete(false)}
      >
        {confirmingDelete ? t('memo.tagDeleteConfirm') : '×'}
      </button>
    </div>
  );
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
  onRenameTag,
  onDeleteTag,
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
    // Local day key — the UTC key would mislabel entries between 00:00 and
    // the local-offset hour (e.g. 00:00–08:00 in Asia/Shanghai).
    const days = daysUntil(instance.date, dayKey(new Date()));
    if (days < 0) return t('memo.due.overdue');
    if (days === 0) return t('memo.due.today');
    return t('memo.due.inDays', { count: days });
  };

  return (
    <aside className="memo-sidebar">
      <div className="memo-sidebar__section memo-due" data-testid="due-card">
        <h3 className="memo-sidebar__heading">
          {t('memo.due.title')}
          <span className="memo-sidebar__total" data-testid="due-total">
            {due.length}
          </span>
        </h3>
        <div className="memo-sidebar__scroll">
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
        </div>
        {notifySupport === 'default' && (
          <Button size="sm" className="memo-due__enable" onClick={onEnableNotify}>
            {t('memo.notifyEnable')}
          </Button>
        )}
      </div>

      <div className="memo-sidebar__section memo-sidebar__section--tags">
        <h3 className="memo-sidebar__heading">
          {t('memo.filter.tags')}
          <span className="memo-sidebar__total" data-testid="tag-total">
            {tags.length}
          </span>
        </h3>
        <div className="memo-sidebar__scroll">
          {tags.length === 0 ? (
            <p className="memo-sidebar__empty">{t('memo.filter.noTags')}</p>
          ) : (
            tags.map(({ tag, count }) => (
              <TagRow
                key={tag}
                tag={tag}
                count={count}
                checked={filters.tags.includes(tag)}
                onToggle={() => toggleTag(tag)}
                onRename={(to) => onRenameTag(tag, to)}
                onDelete={() => onDeleteTag(tag)}
              />
            ))
          )}
        </div>
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
