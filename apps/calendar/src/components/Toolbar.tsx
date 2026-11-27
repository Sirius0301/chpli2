import { useTranslation } from 'react-i18next';
import { Button, Tabs } from '@chpli2/ui';

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
      <Tabs
        className="cal-toolbar__views"
        items={(['month', 'week', 'day'] as const).map((mode) => ({
          value: mode,
          label: t(`memo.view.${mode}`),
        }))}
        value={view}
        onChange={onViewChange}
        variant="pill"
        size="sm"
      />
    </div>
  );
}
