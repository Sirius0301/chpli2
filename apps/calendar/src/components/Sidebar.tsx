import { useTranslation } from 'react-i18next';
import type { CalendarDto, DueReminderDto } from '@chpli2/shared';
import { dayKey, monthGrid, sameDay, startOfMonth } from '../dates';

interface SidebarProps {
  calendars: CalendarDto[];
  anchor: Date;
  dueReminders: DueReminderDto[];
  onAnchorChange: (date: Date) => void;
  onToggleHidden: (calendar: CalendarDto) => void;
  onAddCalendar: () => void;
  onDeleteCalendar: (calendar: CalendarDto) => void;
  onOpenEvent: (eventId: string) => void;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function Sidebar({
  calendars,
  anchor,
  dueReminders,
  onAnchorChange,
  onToggleHidden,
  onAddCalendar,
  onDeleteCalendar,
  onOpenEvent,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const today = new Date();
  const grid = monthGrid(anchor);
  const anchorMonth = startOfMonth(anchor).getMonth();

  return (
    <aside className="cal-sidebar">
      <div className="cal-sidebar__section">
        <div className="cal-sidebar__mini">
          <h3 className="cal-sidebar__heading">
            {anchor.toLocaleString(i18n.language, { year: 'numeric', month: 'long' })}
          </h3>
          <div className="mini-weekdays">
            {WEEKDAY_KEYS.map((key) => (
              <span key={key}>{t(`calendar.weekdays.${key}`)}</span>
            ))}
          </div>
          <div className="mini-grid">
            {grid.map((day) => (
              <button
                key={dayKey(day)}
                type="button"
                className={[
                  'mini-day',
                  day.getMonth() !== anchorMonth ? 'mini-day--outside' : '',
                  sameDay(day, anchor) ? 'mini-day--selected' : '',
                  sameDay(day, today) ? 'mini-day--today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onAnchorChange(day)}
              >
                {day.getDate()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cal-sidebar__section cal-sidebar__calendars">
        <div className="cal-sidebar__row">
          <h3 className="cal-sidebar__heading">{t('calendar.sidebar.calendars')}</h3>
          <button type="button" className="button button--small" onClick={onAddCalendar}>
            +
          </button>
        </div>
        <ul className="calendar-list">
          {calendars.map((calendar) => (
            <li key={calendar.id} className="calendar-list__item">
              <label className="calendar-list__label">
                <input
                  type="checkbox"
                  checked={!calendar.hidden}
                  onChange={() => onToggleHidden(calendar)}
                />
                <span className="calendar-list__dot" style={{ backgroundColor: calendar.color }} />
                <span className={calendar.hidden ? 'calendar-list__name calendar-list__name--hidden' : 'calendar-list__name'}>
                  {calendar.name}
                </span>
              </label>
              {!calendar.isDefault && (
                <button
                  type="button"
                  className="calendar-list__delete"
                  aria-label={`${t('common.delete')} ${calendar.name}`}
                  onClick={() => onDeleteCalendar(calendar)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="cal-sidebar__section cal-sidebar__due">
        <h3 className="cal-sidebar__heading">{t('calendar.sidebar.dueReminders')}</h3>
        {dueReminders.length === 0 ? (
          <p className="cal-sidebar__empty">{t('calendar.sidebar.noReminders')}</p>
        ) : (
          <ul className="due-list">
            {dueReminders.map((reminder) => {
              const triggerDay = new Date(reminder.triggerAt);
              const diffDays = Math.ceil(
                (new Date(triggerDay.getFullYear(), triggerDay.getMonth(), triggerDay.getDate()).getTime() -
                  new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
                  86_400_000,
              );
              const label =
                diffDays < 0
                  ? t('calendar.sidebar.remindersOverdue')
                  : diffDays === 0
                    ? t('calendar.sidebar.remindersToday')
                    : t('calendar.sidebar.remindersDaysLeft', { count: diffDays });
              return (
                <li key={reminder.id}>
                  <button
                    type="button"
                    className="due-item"
                    onClick={() => onOpenEvent(reminder.event.id)}
                  >
                    <span
                      className="due-item__dot"
                      style={{ backgroundColor: reminder.event.calendarColor }}
                    />
                    <span className="due-item__body">
                      <span className="due-item__title">{reminder.event.title}</span>
                      <span className="due-item__meta">
                        {label} ·{' '}
                        {triggerDay.toLocaleDateString(i18n.language, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
