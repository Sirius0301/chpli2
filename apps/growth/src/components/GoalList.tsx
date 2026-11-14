import { useTranslation } from 'react-i18next';
import type { GoalDto } from '@chpli2/shared';

interface GoalListProps {
  goals: GoalDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function GoalList({ goals, selectedId, onSelect }: GoalListProps) {
  const { t } = useTranslation();
  if (goals.length === 0) {
    return <p className="goal-list__empty">{t('goal.empty')}</p>;
  }
  return (
    <ul className="goal-list">
      {goals.map((goal) => (
        <li key={goal.id}>
          <button
            type="button"
            className={
              goal.id === selectedId ? 'goal-list__item goal-list__item--active' : 'goal-list__item'
            }
            onClick={() => onSelect(goal.id)}
          >
            <span className="goal-list__title">{goal.title}</span>
            <span className={`goal-badge goal-badge--${goal.status}`}>
              {t(`goal.status.${goal.status}`)}
            </span>
            <span className="goal-list__progress">
              <span
                className="goal-list__progress-bar"
                style={{ width: `${goal.progress}%` }}
                data-testid={`progress-${goal.id}`}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
