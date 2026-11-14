import { useTranslation } from 'react-i18next';
import { Button } from '@chpli2/ui';

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
        <Button size="sm" onClick={() => onNavigate(-1)} aria-label="‹">
          ‹
        </Button>
        <Button size="sm" onClick={onToday}>
          {t('common.today')}
        </Button>
        <Button size="sm" onClick={() => onNavigate(1)} aria-label="›">
          ›
        </Button>
      </div>
      <h2 className="cal-toolbar__title">{title}</h2>
      <div className="cal-toolbar__views" role="tablist">
        {(['month', 'week', 'day'] as const).map((mode) => (
          <Button
            key={mode}
            role="tab"
            aria-selected={view === mode}
            variant={view === mode ? 'primary' : 'default'}
            size="sm"
            onClick={() => onViewChange(mode)}
          >
            {t(`memo.view.${mode}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
