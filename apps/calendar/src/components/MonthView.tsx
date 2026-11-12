import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dayKey, sameDay } from '../dates';
import { lunarDayLabel, lunarInfoFor } from '../lunar';
import type { DisplayMemoInstance } from '../view-model';
import { instancesByDay } from '../view-model';
import MemoChip from './MemoChip';

/** Max chips shown per cell before the "more" affordance. */
const VISIBLE_CHIPS = 3;

interface MonthViewProps {
  days: Date[];
  /** The month being displayed (cells outside it are dimmed). */
  anchor: Date;
  instances: DisplayMemoInstance[];
  onDayClick: (day: Date) => void;
  onOpen: (instance: DisplayMemoInstance) => void;
  onToggle: (instance: DisplayMemoInstance) => void;
  onShowDay: (day: Date) => void;
}

/** Sunday-first 6x7 month grid of dated memo chips (M1 三视图改造). */
export default function MonthView({
  days,
  anchor,
  instances,
  onDayClick,
  onOpen,
  onToggle,
  onShowDay,
}: MonthViewProps) {
  const { t, i18n } = useTranslation();
  const byDay = instancesByDay(instances);
  const today = new Date();

  // Lunar layer: zh-CN only (M2 D3); silently absent outside 1900-2100 (E56).
  const showLunar = i18n.language.startsWith('zh');
  const lunarByDay = useMemo(() => {
    if (!showLunar) return null;
    const map = new Map<string, ReturnType<typeof lunarInfoFor>>();
    for (const day of days) map.set(dayKey(day), lunarInfoFor(day));
    return map;
  }, [days, showLunar]);

  return (
    <div className="month-view">
      <div className="month-view__weekdays">
        {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map((dow) => (
          <div key={dow} className="month-view__weekday">
            {t(`memo.weekdays.${dow}`)}
          </div>
        ))}
      </div>
      <div className="month-view__grid">
        {days.map((day) => {
          const key = dayKey(day);
          const dayInstances = byDay.get(key) ?? [];
          const visible = dayInstances.slice(0, VISIBLE_CHIPS);
          const hiddenCount = dayInstances.length - visible.length;
          const inMonth =
            day.getMonth() === anchor.getMonth() && day.getFullYear() === anchor.getFullYear();
          const lunar = lunarByDay?.get(key) ?? null;
          return (
            <div
              key={key}
              className={[
                'month-view__cell',
                inMonth ? '' : 'month-view__cell--outside',
                sameDay(day, today) ? 'month-view__cell--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-day={key}
            >
              <div className="month-view__head">
                <button
                  type="button"
                  className="month-view__daynum"
                  onClick={() => onDayClick(day)}
                  aria-label={day.toLocaleDateString(i18n.language, {
                    month: 'long',
                    day: 'numeric',
                  })}
                >
                  {day.getDate()}
                </button>
                {lunar && (
                  <span className="month-view__lunar">{lunarDayLabel(lunar)}</span>
                )}
              </div>
              {lunar?.jieQi && <span className="month-view__jieqi">{lunar.jieQi}</span>}
              <div className="month-view__chips">
                {visible.map((instance) => (
                  <MemoChip
                    key={instance.key}
                    instance={instance}
                    onToggle={onToggle}
                    onOpen={onOpen}
                  />
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="month-view__more"
                    onClick={() => onShowDay(day)}
                  >
                    {t('memo.more', { count: hiddenCount })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
