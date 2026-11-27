import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input, Select, SidePanel, TagInput, Textarea } from '@chpli2/ui';
import type { MemoDto, MemoPriority, MemoRepeatRule } from '@chpli2/shared';
import {
  MEMO_PRIORITIES,
  MEMO_REPEAT_UI_OPTIONS,
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
  /** Custom rule only: weekdays (0=Sun…6=Sat); empty otherwise. */
  repeatDays: number[];
  note: string;
  tags: string[];
}

/** Imperative handle so the shell can save before switching memos. */
export interface DetailPanelHandle {
  /** Validates and submits; resolves true when the memo was saved. */
  submit: () => Promise<boolean>;
}

interface DetailPanelProps {
  mode: 'create' | 'edit';
  /** Preselected date (YYYY-MM-DD) for create mode. */
  initialDate: string;
  /** The memo being edited (edit mode). */
  memo?: MemoDto;
  onSubmit: (values: MemoFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** Repeating memos only: deletes just the open instance's day. */
  onDeleteInstance?: () => Promise<void>;
  onClose: () => void;
  /** Reports whether the form differs from its initial values. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Controlled panel width and resize hook (Memo layout). */
  width?: number;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  resizeLabel?: string;
}

/** Weekday toggle order in the custom-repeat editor: Monday first. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_I18N = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Local weekday (0=Sun…6=Sat) of a YYYY-MM-DD key. */
function weekdayOfKey(key: string): number {
  return new Date(`${key}T00:00:00`).getDay();
}

/** Right-hand memo editor (M1); M3 adds the responsive drawer/bottom-sheet. */
const DetailPanel = forwardRef<DetailPanelHandle, DetailPanelProps>(function DetailPanel(
  {
    mode,
    initialDate,
    memo,
    onSubmit,
    onDelete,
    onDeleteInstance,
    onClose,
    onDirtyChange,
    width,
    onWidthChange,
    minWidth,
    maxWidth,
    resizeLabel,
  },
  ref,
) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(memo?.title ?? '');
  const [date, setDate] = useState(memo?.date ?? initialDate);
  const [priority, setPriority] = useState<MemoPriority>(memo?.priority ?? 'none');
  const [repeat, setRepeat] = useState<MemoRepeatRule>(memo?.repeat ?? 'none');
  const [repeatEnd, setRepeatEnd] = useState(memo?.repeatEnd ?? '');
  const [repeatDays, setRepeatDays] = useState<number[]>(memo?.repeatDays ?? []);
  const [note, setNote] = useState(memo?.note ?? '');
  const [tags, setTags] = useState<string[]>(memo?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);


  // Repeat options: the cleaned-up preset list; a memo still carrying a
  // legacy rule (weekly/biweekly/weekdays) keeps it visible so the select
  // never shows a blank value.
  const repeatOptions = useMemo(() => {
    const options: MemoRepeatRule[] = [...MEMO_REPEAT_UI_OPTIONS];
    if (memo && !options.includes(memo.repeat)) options.push(memo.repeat);
    return options;
  }, [memo]);

  const snapshot = (values: MemoFormValues) => JSON.stringify(values);
  const initialSnapshot = useRef(
    snapshot({
      title: memo?.title ?? '',
      date: memo?.date ?? initialDate,
      priority: memo?.priority ?? 'none',
      repeat: memo?.repeat ?? 'none',
      repeatEnd: memo?.repeatEnd ?? null,
      repeatDays: memo?.repeatDays ?? [],
      note: memo?.note ?? '',
      tags: memo?.tags ?? [],
    }),
  );

  const currentValues = (): MemoFormValues => ({
    title: title.trim(),
    date,
    priority,
    repeat,
    repeatEnd: repeat !== 'none' && repeatEnd ? repeatEnd : null,
    repeatDays: repeat === 'custom' ? repeatDays : [],
    note: note.trim(),
    tags,
  });

  const dirty = snapshot(currentValues()) !== initialSnapshot.current;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleRepeatChange = (next: MemoRepeatRule) => {
    setRepeat(next);
    // Default the custom rule to the memo date's weekday so the selection
    // is never silently empty.
    if (next === 'custom' && repeatDays.length === 0 && isDateKey(date)) {
      setRepeatDays([weekdayOfKey(date)]);
    }
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return t('memo.error.titleRequired');
    if (!isDateKey(date)) return t('memo.error.badDate');
    if (repeat === 'custom' && repeatDays.length === 0) return t('memo.error.badRepeatDays');
    if (repeat !== 'none' && repeatEnd && (!isDateKey(repeatEnd) || repeatEnd < date)) {
      return t('memo.error.badRepeatEnd');
    }
    return null;
  };

  const handleSubmit = async (): Promise<boolean> => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(currentValues());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  const isRepeating = memo !== undefined && memo.repeat !== 'none';

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    await onDelete?.();
  };

  const handleDeleteInstance = async () => {
    setConfirmingDelete(false);
    await onDeleteInstance?.();
  };

  return (
    <SidePanel
      onClose={onClose}
      title={t(mode === 'create' ? 'memo.createTitle' : 'memo.editTitle')}
      ariaLabel={t(mode === 'create' ? 'memo.createTitle' : 'memo.editTitle')}
      closeLabel={t('common.close')}
      size="sm"
      width={width}
      resizable={onWidthChange !== undefined}
      minWidth={minWidth}
      maxWidth={maxWidth}
      resizeLabel={resizeLabel}
      onWidthChange={onWidthChange}
      mobileSheet
      className="detail-panel"
      backdropClassName="detail-panel-backdrop"
      footer={
        <div className="detail-panel__actions">
          <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
            {t('common.save')}
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {mode === 'edit' && onDelete && isRepeating && confirmingDelete ? (
            <>
              {onDeleteInstance && (
                <Button variant="danger" onClick={() => void handleDeleteInstance()}>
                  {t('memo.deleteThisDay')}
                </Button>
              )}
              <Button variant="danger" onClick={() => void handleDelete()}>
                {t('memo.deleteAll')}
              </Button>
              <Button onClick={() => setConfirmingDelete(false)}>{t('common.cancel')}</Button>
            </>
          ) : (
            mode === 'edit' &&
            onDelete && (
              <Button
                variant={confirmingDelete ? 'danger' : 'default'}
                onClick={() => void handleDelete()}
              >
                {confirmingDelete ? t('memo.deleteConfirm') : t('common.delete')}
              </Button>
            )
          )}
        </div>
      }
    >
      <Field label={t('memo.title')}>
        <Input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={256}
          autoFocus
        />
      </Field>

      <Field label={t('memo.date')}>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>

      <Field label={t('memo.priorityLabel')}>
        <Select value={priority} onChange={(event) => setPriority(event.target.value as MemoPriority)}>
          {MEMO_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t(`memo.priority.${p}`)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('memo.repeatLabel')}>
        <Select value={repeat} onChange={(event) => handleRepeatChange(event.target.value as MemoRepeatRule)}>
          {repeatOptions.map((r) => (
            <option key={r} value={r}>
              {t(`memo.repeat.${r}`)}
            </option>
          ))}
        </Select>
      </Field>

      {repeat === 'custom' && (
        <Field as="div" label={t('memo.repeatDaysLabel')} hint={t('memo.repeatDaysHint')}>
          <div className="repeat-days" role="group" aria-label={t('memo.repeatDaysLabel')}>
            {WEEKDAY_ORDER.map((day) => (
              <label key={day} className="repeat-days__day">
                <input
                  type="checkbox"
                  checked={repeatDays.includes(day)}
                  onChange={() => toggleRepeatDay(day)}
                />
                <span>{t(`memo.weekdays.${WEEKDAY_I18N[day]}`)}</span>
              </label>
            ))}
          </div>
        </Field>
      )}

      {repeat !== 'none' && (
        <Field label={t('memo.repeatEnd')} hint={t('memo.repeatEndPlaceholder')}>
          <Input
            type="date"
            value={repeatEnd}
            min={date}
            onChange={(event) => setRepeatEnd(event.target.value)}
          />
        </Field>
      )}

      <Field
        label={t('memo.tagsLabel')}
        hint={t('memo.tagHint', { max: MEMO_TAGS_MAX_COUNT, length: MEMO_TAG_MAX_LENGTH })}
        error={tagError}
      >
        <TagInput
          className="tag-editor"
          value={tags}
          onChange={setTags}
          maxCount={MEMO_TAGS_MAX_COUNT}
          maxLength={MEMO_TAG_MAX_LENGTH}
          placeholder={t('memo.tagInputPlaceholder')}
          addLabel={t('memo.tagsLabel')}
          removeLabel={(tag) => t('memo.tagRemove', { tag })}
          onError={(reason) => {
            if (reason === 'TAG_TOO_LONG') setTagError(t('memo.error.badTagLength'));
            else if (reason === 'TOO_MANY_TAGS') setTagError(t('memo.error.badTagCount'));
            else setTagError(null);
          }}
        />
      </Field>

      <Field label={t('memo.note')}>
        <Textarea value={note} rows={4} onChange={(event) => setNote(event.target.value)} />
      </Field>

      {mode === 'edit' && memo ? (
        <MemoImages memoId={memo.id} />
      ) : (
        <p className="detail-panel__hint">{t('memo.imageCreateHint')}</p>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
    </SidePanel>
  );
});

export default DetailPanel;
