import { useTranslation } from 'react-i18next';
import type { DisplayMemoInstance } from '../view-model';

interface MemoChipProps {
  instance: DisplayMemoInstance;
  onToggle: (instance: DisplayMemoInstance) => void;
  onOpen: (instance: DisplayMemoInstance) => void;
}

/** A single dated memo instance: completion checkbox + title button. */
export default function MemoChip({ instance, onToggle, onOpen }: MemoChipProps) {
  const { t } = useTranslation();
  const classes = [
    'memo-chip',
    `memo-chip--${instance.priority}`,
    instance.completed ? 'memo-chip--done' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      data-memo-id={instance.memoId}
      data-date={instance.date}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        className="memo-chip__check"
        checked={instance.completed}
        onChange={() => onToggle(instance)}
        aria-label={t('memo.toggleComplete', { title: instance.title })}
      />
      <button
        type="button"
        className="memo-chip__title"
        onClick={() => onOpen(instance)}
      >
        {instance.title}
      </button>
      {instance.repeat !== 'none' && (
        <span className="memo-chip__repeat" title={t('memo.repeatBadge')} aria-hidden>
          ↻
        </span>
      )}
    </div>
  );
}
