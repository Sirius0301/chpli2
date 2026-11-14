import './i18n';
import './styles.css';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GoalDto } from '@chpli2/shared';
import {
  ApiError,
  addLink,
  addMilestone,
  createGoal,
  deleteGoal,
  listGoals,
  removeLink,
  removeMilestone,
  updateGoal,
  updateMilestone,
} from './api';
import GoalList from './components/GoalList';
import GoalDetail from './components/GoalDetail';
import GoalEditor from './components/GoalEditor';
import SkillsPage from './components/SkillsPage';
import ReviewsPage from './components/ReviewsPage';

export default function GrowthApp() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'goals' | 'skills' | 'reviews'>('goals');
  const [goals, setGoals] = useState<GoalDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ kind: 'new' } | { kind: 'edit'; goal: GoalDto } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selected = goals?.find((g) => g.id === selectedId) ?? null;

  const reload = useCallback(async () => {
    setGoals(await listGoals());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listGoals();
        if (!cancelled) {
          setGoals(rows);
          setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyGoal = useCallback((updated: GoalDto) => {
    setGoals((prev) => prev?.map((g) => (g.id === updated.id ? updated : g)) ?? prev);
  }, []);

  const handleSubmit = async (values: {
    title: string;
    description: string;
    targetDate: string | null;
  }) => {
    if (editing?.kind === 'edit') {
      const updated = await updateGoal(editing.goal.id, {
        ...values,
        updatedAt: editing.goal.updatedAt,
      });
      applyGoal(updated);
    } else {
      const created = await createGoal({ id: crypto.randomUUID(), ...values });
      setGoals((prev) => [created, ...(prev ?? [])]);
      setSelectedId(created.id);
    }
    setEditing(null);
    setConfirmingDelete(false);
    await reload();
  };

  const handleDelete = async () => {
    if (editing?.kind !== 'edit') return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    await deleteGoal(editing.goal.id);
    setGoals((prev) => (prev ?? []).filter((g) => g.id !== editing.goal.id));
    setSelectedId(null);
    setEditing(null);
  };

  if (goals === null && loadError) {
    return (
      <section>
        <div className="goal-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <button type="button" className="button" onClick={() => void reload().then(() => setLoadError(null))}>
            {t('common.retry')}
          </button>
        </div>
      </section>
    );
  }

  if (goals === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  return (
    <section className="goal-app">
      <aside className="goal-side">
        <div className="goal-side__head">
          <h2>{t('goal.title')}</h2>
          {tab === 'goals' && (
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setConfirmingDelete(false);
                setEditing({ kind: 'new' });
              }}
            >
              {t('goal.new')}
            </button>
          )}
        </div>
        <div className="goal-tabs" role="tablist">
          {(['goals', 'skills', 'reviews'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? 'button button--active' : 'button'}
              onClick={() => setTab(value)}
            >
              {t(`growth.tab.${value}`)}
            </button>
          ))}
        </div>
        {tab === 'goals' && <GoalList goals={goals} selectedId={selectedId} onSelect={setSelectedId} />}
        {tab === 'skills' && <SkillsPage goals={goals} />}
        {tab === 'reviews' && <ReviewsPage goals={goals} />}
      </aside>

      <div className="goal-main">
        {tab !== 'goals' ? (
          <p className="goal-empty" data-testid="tab-hint">
            {t(`growth.tab.${tab}`)}
          </p>
        ) : selected ? (
          <GoalDetail
            goal={selected}
            onChanged={applyGoal}
            onEdit={() => {
              setConfirmingDelete(false);
              setEditing({ kind: 'edit', goal: selected });
            }}
            onStatusChange={(status) =>
              updateGoal(selected.id, { status, updatedAt: selected.updatedAt }).then((updated) => {
                applyGoal(updated);
              })
            }
            addMilestone={addMilestone}
            updateMilestone={updateMilestone}
            removeMilestone={removeMilestone}
            addLink={addLink}
            removeLink={removeLink}
          />
        ) : (
          <p className="goal-empty">{t('goal.empty')}</p>
        )}
      </div>

      {editing && (
        <GoalEditor
          mode={editing.kind}
          goal={editing.kind === 'edit' ? editing.goal : undefined}
          confirmingDelete={confirmingDelete}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onClose={() => {
            setEditing(null);
            setConfirmingDelete(false);
          }}
        />
      )}
    </section>
  );
}
