import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemoDto, MemoPriority, MemoRepeatRule } from '@chpli2/shared';
import { MEMO_PRIORITIES, MEMO_REPEAT_ALL, isDateKey } from '@chpli2/shared';

export interface MemoFormValues {
  title: string;
  date: string;
  priority: MemoPriority;
  repeat: MemoRepeatRule;
  repeatEnd: string | null;
  note: string;
}

interface DetailPanelProps {
  mode: 'create' | 'edit';
  /** Preselected date (YYYY-MM-DD) for create mode. */
  initialDate: string;
  /** The memo being edited (edit mode). */
  memo?: MemoDto;
  onSubmit: (values: MemoFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

/** Right-hand memo editor (M1); M3 adds the responsive drawer/bottom-sheet. */
export default function DetailPanel({
  mode,
  initialDate,
  memo,
  onSubmit,
  onDelete,
  onClose,
}: DetailPanelProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(memo?.title ?? '');
  const [date, setDate] = useState(memo?.date ?? initialDate);
  const [priority, setPriority] = useState<MemoPriority>(memo?.priority ?? 'none');
  const [repeat, setRepeat] = useState<MemoRepeatRule>(memo?.repeat ?? 'none');
  const [repeatEnd, setRepeatEnd] = useState(memo?.repeatEnd ?? '');
  const [note, setNote] = useState(memo?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const validate = (): string | null => {
    if (!title.trim()) return t('memo.error.titleRequired');
    if (!isDateKey(date)) return t('memo.error.badDate');
    if (repeat !== 'none' && repeatEnd && (!isDateKey(repeatEnd) || repeatEnd < date)) {
      return t('memo.error.badRepeatEnd');
    }
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        date,
        priority,
        repeat,
        repeatEnd: repeat !== 'none' && repeatEnd ? repeatEnd : null,
        note: note.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    await onDelete?.();
  };

  return (
    <aside className="detail-panel" aria-label={t(mode === 'create' ? 'memo.createTitle' : 'memo.editTitle')}>
      <div className="detail-panel__header">
        <h3>{t(mode === 'create' ? 'memo.createTitle' : 'memo.editTitle')}</h3>
        <button type="button" className="button" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>
      </div>

      <label className="detail-panel__field">
        <span>{t('memo.title')}</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={256}
          autoFocus
        />
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.date')}</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.priorityLabel')}</span>
        <select value={priority} onChange={(event) => setPriority(event.target.value as MemoPriority)}>
          {MEMO_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`memo.priority.${p}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.repeatLabel')}</span>
        <select value={repeat} onChange={(event) => setRepeat(event.target.value as MemoRepeatRule)}>
          {MEMO_REPEAT_ALL.map((r) => (
            <option key={r} value={r}>
              {t(`memo.repeat.${r}`)}
            </option>
          ))}
        </select>
      </label>

      {repeat !== 'none' && (
        <label className="detail-panel__field">
          <span>{t('memo.repeatEnd')}</span>
          <input
            type="date"
            value={repeatEnd}
            min={date}
            onChange={(event) => setRepeatEnd(event.target.value)}
          />
          <span className="detail-panel__hint">{t('memo.repeatEndPlaceholder')}</span>
        </label>
      )}

      <label className="detail-panel__field">
        <span>{t('memo.note')}</span>
        <textarea value={note} rows={4} onChange={(event) => setNote(event.target.value)} />
      </label>

      {error && (
        <p className="detail-panel__error" role="alert">
          {error}
        </p>
      )}

      <div className="detail-panel__actions">
        <button type="button" className="button button--primary" disabled={saving} onClick={() => void handleSubmit()}>
          {t('common.save')}
        </button>
        <button type="button" className="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
        {mode === 'edit' && onDelete && (
          <button
            type="button"
            className={confirmingDelete ? 'button button--danger' : 'button'}
            onClick={() => void handleDelete()}
          >
            {confirmingDelete ? t('memo.deleteConfirm') : t('common.delete')}
          </button>
        )}
      </div>
    </aside>
  );
}
