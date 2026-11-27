import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dayKey, sameDay } from '../dates';
import type { DisplayMemoInstance } from '../view-model';
import { instancesByDay } from '../view-model';
import MemoChip from './MemoChip';

interface DayColumnProps {
  day: Date;
  instances: DisplayMemoInstance[];
  /** True when the day has an uncompleted instance due today (M4). */
  dueToday?: boolean;
  onDayClick: (day: Date) => void;
  onOpen: (instance: DisplayMemoInstance) => void;
  onToggle: (instance: DisplayMemoInstance) => void;
}

/** One day column: header + memo list + click-to-create body. */
function DayColumn({ day, instances, dueToday, onDayClick, onOpen, onToggle }: DayColumnProps) {
  const { t, i18n } = useTranslation();
  const today = sameDay(day, new Date());
  return (
    <div className={today ? 'day-col day-col--today' : 'day-col'} data-day={dayKey(day)}>
      <button type="button" className="day-col__header" onClick={() => onDayClick(day)}>
        <span className="day-col__weekday">
          {t(`memo.weekdays.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day.getDay()]}`)}
        </span>
        <span className="day-col__date">
          {day.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
        </span>
        {dueToday && <span className="day-col__due-dot" title={t('memo.dueBadge')} />}
      </button>
      <div
        className="day-col__body"
        data-testid={today ? 'today-column-body' : undefined}
        role="button"
        tabIndex={0}
        onClick={() => onDayClick(day)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onDayClick(day);
        }}
        aria-label={t('memo.createOn', {
          date: day.toLocaleDateString(i18n.language, { dateStyle: 'medium' }),
        })}
      >
        {instances.length === 0 ? (
          <span className="day-col__empty">{t('memo.empty')}</span>
        ) : (
          instances.map((instance) => (
            <MemoChip key={instance.key} instance={instance} onToggle={onToggle} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  );
}

interface WeekViewProps {
  days: Date[];
  instances: DisplayMemoInstance[];
  /** Day keys with an uncompleted instance due today (M4 header dot). */
  dueBadges?: Set<string>;
  onDayClick: (day: Date) => void;
  onOpen: (instance: DisplayMemoInstance) => void;
  onToggle: (instance: DisplayMemoInstance) => void;
}

/** Seven Sunday-first day columns (the default M1 view). */
export default function WeekView({ days, instances, dueBadges, onDayClick, onOpen, onToggle }: WeekViewProps) {
  const byDay = instancesByDay(instances);
  return (
    <div className="week-view">
      {days.map((day) => (
        <DayColumn
          key={dayKey(day)}
          day={day}
          instances={byDay.get(dayKey(day)) ?? []}
          dueToday={dueBadges?.has(dayKey(day)) ?? false}
          onDayClick={onDayClick}
          onOpen={onOpen}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

interface DayViewProps extends WeekViewProps {
  /** Optional right rail (Memo day view shows notes created that day). */
  aside?: ReactNode;
}

/** Single-day column view. */
export function DayView({ days, instances, dueBadges, onDayClick, onOpen, onToggle, aside }: DayViewProps) {
  const byDay = instancesByDay(instances);
  const day = days[0]!;
  return (
    <div className="day-view">
      <DayColumn
        day={day}
        instances={byDay.get(dayKey(day)) ?? []}
        dueToday={dueBadges?.has(dayKey(day)) ?? false}
        onDayClick={onDayClick}
        onOpen={onOpen}
        onToggle={onToggle}
      />
      {aside}
    </div>
  );
}
