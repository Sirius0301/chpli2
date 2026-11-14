import { useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GoalDto } from '@chpli2/shared';
import { GOAL_STATUSES } from '@chpli2/shared';

interface GoalEditorProps {
  mode: 'new' | 'edit';
  goal?: GoalDto;
  confirmingDelete: boolean;
  onSubmit: (values: {
    title: string;
    description: string;
    targetDate: string | null;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export default function GoalEditor({
  mode,
  goal,
  confirmingDelete,
  onSubmit,
  onDelete,
  onClose,
}: GoalEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t('goal.titlePlaceholder'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        targetDate: targetDate || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="goal-editor-wrap">
      <div className="goal-editor-backdrop" onClick={onClose} aria-hidden />
      <aside className="goal-editor" aria-label={t(mode === 'new' ? 'goal.new' : 'goal.edit')}>
        <div className="goal-editor__header">
          <h3>{t(mode === 'new' ? 'goal.new' : 'goal.edit')}</h3>
          <button type="button" className="button" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <label className="goal-editor__field">
          <span>{t('goal.titlePlaceholder')}</span>
          <input
            type="text"
            value={title}
            maxLength={256}
            placeholder={t('goal.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </label>

        <label className="goal-editor__field">
          <span>{t('goal.descriptionPlaceholder')}</span>
          <textarea
            value={description}
            rows={3}
            placeholder={t('goal.descriptionPlaceholder')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="goal-editor__field">
          <span>{t('goal.targetDate')}</span>
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>

        {error && (
          <p className="goal-editor__error" role="alert">
            {error}
          </p>
        )}

        <div className="goal-editor__actions">
          <button
            type="button"
            className="button button--primary"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {t('common.save')}
          </button>
          <button type="button" className="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              className={confirmingDelete ? 'button button--danger' : 'button'}
              onClick={() => void onDelete()}
            >
              {confirmingDelete ? t('goal.milestone.deleteConfirm') : t('common.delete')}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
