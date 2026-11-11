import { useTranslation } from 'react-i18next';
import type { DisplayEvent } from '../view-model';

interface EventPopoverProps {
  event: DisplayEvent;
  position: { x: number; y: number };
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Small summary bubble shown on event click (A11). */
export default function EventPopover({ event, position, onEdit, onDelete, onClose }: EventPopoverProps) {
  const { t, i18n } = useTranslation();
  const top = Math.min(position.y, window.innerHeight - 220);
  const left = Math.min(position.x, window.innerWidth - 300);
  const timeText = event.allDay
    ? `${event.startAt.toLocaleDateString(i18n.language)} – ${new Date(
        event.endAt.getTime() - 86_400_000,
      ).toLocaleDateString(i18n.language)}`
    : `${event.startAt.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })} – ${event.endAt.toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })}`;

  // F4: surface the event's own timezone semantics in the summary bubble.
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let zoneBadge: string | null = null;
  if (!event.allDay && event.source) {
    if (event.source.timezone === null) {
      zoneBadge = t('calendar.floatingBadge');
    } else if (event.source.timezone !== browserTz) {
      const eventZone = event.source.timezone;
      const wall = (iso: string, timeOnly: boolean): string =>
        new Date(iso).toLocaleString(i18n.language, {
          ...(timeOnly
            ? { hour: 'numeric', minute: '2-digit' }
            : { dateStyle: 'medium', timeStyle: 'short' }),
          timeZone: eventZone,
        });
      zoneBadge = `${eventZone} · ${wall(event.source.startAt, false)} – ${wall(event.source.endAt, true)}`;
    }
  }

  return (
    <div className="popover" style={{ top, left }} role="dialog" aria-label={event.title}>
      <div className="popover__head">
        <span className="popover__dot" style={{ backgroundColor: event.color }} />
        <strong className="popover__title">{event.title}</strong>
        <button type="button" className="popover__close" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <p className="popover__time">{timeText}</p>
      {zoneBadge && <p className="popover__time">{zoneBadge}</p>}
      {event.kind === 'travel' && <p className="popover__time">{t('calendar.travelBadge')}</p>}
      {!event.readonly && (
        <div className="popover__actions">
          <button type="button" className="button button--small" onClick={onEdit}>
            {t('calendar.popover.edit')}
          </button>
          <button type="button" className="button button--small button--danger" onClick={onDelete}>
            {t('calendar.popover.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

interface DayEventsPopoverProps {
  day: Date;
  events: DisplayEvent[];
  position: { x: number; y: number };
  onSelect: (event: DisplayEvent) => void;
  onClose: () => void;
}

/** Expanded list behind a "+N more" affordance in the month view (A9). */
export function DayEventsPopover({ day, events, position, onSelect, onClose }: DayEventsPopoverProps) {
  const { t, i18n } = useTranslation();
  const top = Math.min(position.y, window.innerHeight - 320);
  const left = Math.min(position.x, window.innerWidth - 320);
  return (
    <div className="popover popover--day" style={{ top, left }} role="dialog" aria-label={day.toDateString()}>
      <div className="popover__head">
        <strong className="popover__title">
          {day.toLocaleDateString(i18n.language, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </strong>
        <button type="button" className="popover__close" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <ul className="popover__list">
        {events.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              className="popover__list-item"
              onClick={() => onSelect(event)}
            >
              <span className="popover__dot" style={{ backgroundColor: event.color }} />
              <span className="popover__list-time">
                {event.allDay
                  ? t('calendar.allDay')
                  : event.startAt.toLocaleTimeString(i18n.language, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
              </span>
              <span>{event.title}</span>
              {event.kind === 'travel' && (
                <span className="month-bar__badge">{t('calendar.travelBadge')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
