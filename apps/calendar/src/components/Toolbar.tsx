import { useTranslation } from 'react-i18next';

export type ViewMode = 'month' | 'week' | 'day';

interface ToolbarProps {
  title: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
}

export default function Toolbar({ title, view, onViewChange, onNavigate, onToday }: ToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar__nav">
        <button type="button" className="button" onClick={() => onNavigate(-1)} aria-label="‹">
          ‹
        </button>
        <button type="button" className="button" onClick={onToday}>
          {t('common.today')}
        </button>
        <button type="button" className="button" onClick={() => onNavigate(1)} aria-label="›">
          ›
        </button>
      </div>
      <h2 className="cal-toolbar__title">{title}</h2>
      <div className="cal-toolbar__views" role="tablist">
        {(['month', 'week', 'day'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            className={view === mode ? 'button button--active' : 'button'}
            onClick={() => onViewChange(mode)}
          >
            {t(`memo.view.${mode}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
