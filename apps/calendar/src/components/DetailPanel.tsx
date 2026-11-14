import { useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Input, Select, Textarea } from '@chpli2/ui';
import type { MemoDto, MemoPriority, MemoRepeatRule } from '@chpli2/shared';
import {
  MEMO_PRIORITIES,
  MEMO_REPEAT_ALL,
  MEMO_TAG_MAX_LENGTH,
  MEMO_TAGS_MAX_COUNT,
  isDateKey,
} from '@chpli2/shared';
import MemoImages from './MemoImages';

export interface MemoFormValues {
  title: string;
  date: string;
  priority: MemoPriority;
  repeat: MemoRepeatRule;
  repeatEnd: string | null;
  note: string;
  tags: string[];
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
  const [tags, setTags] = useState<string[]>(memo?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Esc closes the panel — the only keyboard path for the overlay forms (M3 D6).
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    setTagInput('');
    if (!tag) return;
    if (tag.length > MEMO_TAG_MAX_LENGTH) {
      setError(t('memo.error.badTagLength'));
      return;
    }
    if (tags.includes(tag)) return;
    if (tags.length >= MEMO_TAGS_MAX_COUNT) {
      setError(t('memo.error.badTagCount'));
      return;
    }
    setError(null);
    setTags([...tags, tag]);
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
    } else if (event.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

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
        tags,
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
    <div className="detail-panel-wrap">
      <div className="detail-panel-backdrop" onClick={onClose} aria-hidden />
      <aside
        className="detail-panel"
        aria-label={t(mode === 'create' ? 'memo.createTitle' : 'memo.editTitle')}
      >
      <div className="detail-panel__header">
        <h3>{t(mode === 'create' ? 'memo.createTitle' : 'memo.editTitle')}</h3>
        <Button size="sm" onClick={onClose} aria-label={t('common.close')}>
          ×
        </Button>
      </div>

      <label className="detail-panel__field">
        <span>{t('memo.title')}</span>
        <Input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={256}
          autoFocus
        />
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.date')}</span>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.priorityLabel')}</span>
        <Select value={priority} onChange={(event) => setPriority(event.target.value as MemoPriority)}>
          {MEMO_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`memo.priority.${p}`)}
            </option>
          ))}
        </Select>
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.repeatLabel')}</span>
        <Select value={repeat} onChange={(event) => setRepeat(event.target.value as MemoRepeatRule)}>
          {MEMO_REPEAT_ALL.map((r) => (
            <option key={r} value={r}>
              {t(`memo.repeat.${r}`)}
            </option>
          ))}
        </Select>
      </label>

      {repeat !== 'none' && (
        <label className="detail-panel__field">
          <span>{t('memo.repeatEnd')}</span>
          <Input
            type="date"
            value={repeatEnd}
            min={date}
            onChange={(event) => setRepeatEnd(event.target.value)}
          />
          <span className="detail-panel__hint">{t('memo.repeatEndPlaceholder')}</span>
        </label>
      )}

      <label className="detail-panel__field">
        <span>{t('memo.tagsLabel')}</span>
        <div className="tag-editor">
          {tags.map((tag) => (
            <Chip
              key={tag}
              onRemove={() => setTags(tags.filter((x) => x !== tag))}
              removeLabel={t('memo.tagRemove', { tag })}
            >
              {tag}
            </Chip>
          ))}
          <input
            type="text"
            value={tagInput}
            maxLength={MEMO_TAG_MAX_LENGTH + 1}
            placeholder={t('memo.tagInputPlaceholder')}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => addTag(tagInput)}
          />
        </div>
        <span className="detail-panel__hint">
          {t('memo.tagHint', { max: MEMO_TAGS_MAX_COUNT, length: MEMO_TAG_MAX_LENGTH })}
        </span>
      </label>

      <label className="detail-panel__field">
        <span>{t('memo.note')}</span>
        <Textarea value={note} rows={4} onChange={(event) => setNote(event.target.value)} />
      </label>

      {mode === 'edit' && memo ? (
        <MemoImages memoId={memo.id} />
      ) : (
        <p className="detail-panel__hint">{t('memo.imageCreateHint')}</p>
      )}

      {error && (
        <p className="detail-panel__error" role="alert">
          {error}
        </p>
      )}

      <div className="detail-panel__actions">
        <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
          {t('common.save')}
        </Button>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        {mode === 'edit' && onDelete && (
          <Button
            variant={confirmingDelete ? 'danger' : 'default'}
            onClick={() => void handleDelete()}
          >
            {confirmingDelete ? t('memo.deleteConfirm') : t('common.delete')}
          </Button>
        )}
      </div>
      </aside>
    </div>
  );
}
