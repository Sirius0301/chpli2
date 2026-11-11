import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HolidayEntryDto } from '@chpli2/shared';
import {
  addDays,
  addMinutes,
  dayKey,
  layoutOverlaps,
  minutesOfDay,
  sameDay,
} from '../dates';
import type { DisplayEvent } from '../view-model';

const HOUR_HEIGHT = 40;
const SNAP_MINUTES = 15;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export interface WeekViewProps {
  /** 7 days for the week view, 1 day for the day view. */
  days: Date[];
  events: DisplayEvent[];
  holidays: Map<string, HolidayEntryDto[]>;
  onSlotClick: (day: Date, minutes: number) => void;
  onEventClick: (event: DisplayEvent, position: { x: number; y: number }) => void;
  onEventMove: (event: DisplayEvent, startAt: Date, endAt: Date) => void;
  onOpenTrip: (tripId: string) => void;
}

interface DragState {
  event: DisplayEvent;
  mode: 'move' | 'resize';
  startY: number;
  deltaMinutes: number;
}

interface AllDayBar {
  event: DisplayEvent;
  colStart: number;
  colEnd: number;
  lane: number;
}

export default function WeekView({
  days,
  events,
  holidays,
  onSlotClick,
  onEventClick,
  onEventMove,
  onOpenTrip,
}: WeekViewProps) {
  const { t, i18n } = useTranslation();
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  // -- All-day area: multi-day/all-day events as bars across columns --------
  const colIndex = (day: Date) => days.findIndex((d) => sameDay(d, day));
  const allDayBars: AllDayBar[] = [];
  {
    const laneEnds: number[] = [];
    const sorted = [...events.filter((e) => e.allDay)].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );
    for (const event of sorted) {
      const lastInclusive = new Date(event.endAt.getTime() - 1);
      const rawStart = colIndex(event.startAt);
      const rawEnd = colIndex(lastInclusive);
      const colStart = rawStart === -1 ? (event.startAt < days[0]! ? 0 : days.length - 1) : rawStart;
      const colEnd = rawEnd === -1 ? (lastInclusive > days[days.length - 1]! ? days.length - 1 : 0) : rawEnd;
      if (colStart > colEnd) continue;
      let lane = laneEnds.findIndex((end) => end < colStart);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = colEnd;
      allDayBars.push({ event, colStart, colEnd, lane });
    }
  }
  const allDayLanes = allDayBars.reduce((max, b) => Math.max(max, b.lane + 1), 0);

  // -- Timed events per column ------------------------------------------------
  const timedByDay = days.map((day) => {
    const dayStart = day;
    const dayEnd = addDays(day, 1);
    const segments = events
      .filter((e) => !e.allDay && e.startAt < dayEnd && e.endAt > dayStart)
      .map((event) => {
        const from = event.startAt > dayStart ? event.startAt : dayStart;
        const to = event.endAt < dayEnd ? event.endAt : dayEnd;
        return {
          item: event,
          startMinutes: minutesOfDay(from),
          endMinutes: Math.max(minutesOfDay(to), minutesOfDay(from) + SNAP_MINUTES),
        };
      });
    return layoutOverlaps(segments);
  });

  const beginDrag = (event: DisplayEvent, mode: 'move' | 'resize', pointer: React.PointerEvent) => {
    if (event.readonly) return;
    pointer.preventDefault();
    pointer.stopPropagation();
    suppressClick.current = false;
    setDrag({ event, mode, startY: pointer.clientY, deltaMinutes: 0 });
    const onMove = (move: PointerEvent) => {
      const deltaMinutes =
        Math.round(((move.clientY - pointer.clientY) / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES;
      if (deltaMinutes !== 0) suppressClick.current = true;
      setDrag((prev) => (prev ? { ...prev, deltaMinutes } : prev));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag((prev) => {
        if (prev && prev.deltaMinutes !== 0) {
          if (prev.mode === 'move') {
            onEventMove(
              prev.event,
              addMinutes(prev.event.startAt, prev.deltaMinutes),
              addMinutes(prev.event.endAt, prev.deltaMinutes),
            );
          } else {
            onEventMove(
              prev.event,
              prev.event.startAt,
              addMinutes(prev.event.endAt, prev.deltaMinutes),
            );
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const minutesFromPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
    return Math.max(0, Math.min(24 * 60 - SNAP_MINUTES, Math.floor(raw / SNAP_MINUTES) * SNAP_MINUTES));
  };

  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  return (
    <div className="week-view">
      <div className="week-view__header" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
        <span className="week-view__gutter" />
        {days.map((day) => (
          <div
            key={dayKey(day)}
            className={sameDay(day, today) ? 'week-view__dayhead week-view__dayhead--today' : 'week-view__dayhead'}
          >
            <span className="week-view__weekday">
              {t(`calendar.weekdays.${WEEKDAY_KEYS[(day.getDay() + 6) % 7]}`)}
            </span>
            <span className="week-view__daynum">{day.getDate()}</span>
          </div>
        ))}
      </div>

      <div
        className="week-view__allday"
        style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, minHeight: 24 + allDayLanes * 22 }}
      >
        <span className="week-view__gutter">{t('calendar.allDay')}</span>
        <div className="week-view__allday-cells" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day) => {
            const dayHolidays = (holidays.get(dayKey(day)) ?? []).filter((h) => !h.isWorkday);
            return (
              <div key={dayKey(day)} className="week-view__allday-cell">
                {dayHolidays.map((h) => (
                  <div key={h.id} className="week-view__holiday">
                    {h.name}
                  </div>
                ))}
              </div>
            );
          })}
          {allDayBars.map((bar) => (
            <button
              key={`${bar.event.id}`}
              type="button"
              className="month-bar month-bar--readonly week-view__allday-bar"
              style={{
                left: `calc(${(bar.colStart / days.length) * 100}% + 2px)`,
                width: `calc(${((bar.colEnd - bar.colStart + 1) / days.length) * 100}% - 4px)`,
                top: bar.lane * 22,
                backgroundColor: bar.event.color,
              }}
              onClick={(e) => onEventClick(bar.event, { x: e.clientX, y: e.clientY })}
            >
              {bar.event.title}
            </button>
          ))}
        </div>
      </div>

      <div className="week-view__body">
        <div className="week-view__hours">
          {HOURS.map((hour) => (
            <span key={hour} className="week-view__hour" style={{ height: HOUR_HEIGHT }}>
              {hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
            </span>
          ))}
        </div>
        <div className="week-view__columns" ref={bodyRef} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day, col) => (
            <div
              key={dayKey(day)}
              className={sameDay(day, today) ? 'week-view__column week-view__column--today' : 'week-view__column'}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                onSlotClick(day, minutesFromPointer(e));
              }}
            >
              {HOURS.slice(0, 23).map((hour) => (
                <div key={hour} className="week-view__slot" style={{ height: HOUR_HEIGHT }} />
              ))}
              {sameDay(day, today) && (
                <div
                  className="week-view__nowline"
                  style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                />
              )}
              {timedByDay[col]!.map((segment) => {
                const activeDrag = drag?.event.id === segment.item.id ? drag : null;
                const top =
                  ((segment.startMinutes + (activeDrag?.mode === 'move' ? activeDrag.deltaMinutes : 0)) / 60) *
                  HOUR_HEIGHT;
                const rawEnd =
                  segment.endMinutes + (activeDrag ? activeDrag.deltaMinutes : 0);
                const height = Math.max(
                  18,
                  ((Math.max(rawEnd, segment.startMinutes + SNAP_MINUTES) - segment.startMinutes) / 60) * HOUR_HEIGHT,
                );
                return (
                  <div
                    key={`${segment.item.id}-${dayKey(day)}`}
                    className={[
                      'week-event',
                      segment.item.readonly ? 'week-event--readonly' : '',
                      activeDrag ? 'week-event--dragging' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      top,
                      height,
                      left: `calc(${(segment.column / segment.columns) * 100}% + 1px)`,
                      width: `calc(${100 / segment.columns}% - 2px)`,
                      backgroundColor: segment.item.color,
                    }}
                    onPointerDown={(e) => beginDrag(segment.item, 'move', e)}
                    onClick={(e) => {
                      if (suppressClick.current) {
                        e.stopPropagation();
                        return;
                      }
                      if (segment.item.kind === 'travel' && segment.item.tripId) {
                        onOpenTrip(segment.item.tripId);
                      } else {
                        onEventClick(segment.item, { x: e.clientX, y: e.clientY });
                      }
                    }}
                  >
                    <span className="week-event__title">
                      {segment.item.allDay
                        ? segment.item.title
                        : `${new Date(
                            new Date(day).setHours(0, segment.startMinutes, 0, 0),
                          ).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })} ${segment.item.title}`}
                    </span>
                    {!segment.item.readonly && (
                      <span
                        className="week-event__resize"
                        onPointerDown={(e) => beginDrag(segment.item, 'resize', e)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
