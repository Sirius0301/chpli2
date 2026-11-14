import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GoalDto, SkillDto, SkillLevel } from '@chpli2/shared';
import { SKILL_LEVELS } from '@chpli2/shared';

interface SkillEditorProps {
  mode: 'new' | 'edit';
  skill?: SkillDto;
  goals: GoalDto[];
  onSubmit: (values: { name: string; level: SkillLevel; goalId: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export default function SkillEditor({ mode, skill, goals, onSubmit, onDelete, onClose }: SkillEditorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(skill?.name ?? '');
  const [level, setLevel] = useState<SkillLevel>(skill?.level ?? 0);
  const [goalId, setGoalId] = useState<string>(skill?.goalId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('skill.namePlaceholder'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), level, goalId: goalId || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="goal-editor-wrap">
      <div className="goal-editor-backdrop" onClick={onClose} aria-hidden />
      <aside className="goal-editor" aria-label={t(mode === 'new' ? 'skill.new' : 'common.save')}>
        <div className="goal-editor__header">
          <h3>{t(mode === 'new' ? 'skill.new' : 'common.save')}</h3>
          <button type="button" className="button" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <label className="goal-editor__field">
          <span>{t('skill.namePlaceholder')}</span>
          <input
            type="text"
            value={name}
            maxLength={128}
            placeholder={t('skill.namePlaceholder')}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <label className="goal-editor__field">
          <span>{t('skill.level')}</span>
          <select value={level} onChange={(event) => setLevel(Number(event.target.value) as SkillLevel)}>
            {SKILL_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? t('skill.level.0') : `${value}/5`}
              </option>
            ))}
          </select>
        </label>

        <label className="goal-editor__field">
          <span>{t('skill.goalLabel')}</span>
          <select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
            <option value="">{t('skill.goal.none')}</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
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
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                setConfirmingDelete(false);
                void onDelete();
              }}
            >
              {confirmingDelete ? t('goal.milestone.deleteConfirm') : t('common.delete')}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
