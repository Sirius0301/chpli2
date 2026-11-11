import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HolidayEntryDto } from '@chpli2/shared';
import { addDays, dayKey, sameDay } from '../dates';
import { weekSpan, type DisplayEvent } from '../view-model';

const MAX_LANES = 3;
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export interface MonthViewProps {
  days: Date[];
  events: DisplayEvent[];
  holidays: Map<string, HolidayEntryDto[]>;
  onDayClick: (day: Date) => void;
  onDayNavigate: (day: Date) => void;
  onEventClick: (event: DisplayEvent, position: { x: number; y: number }) => void;
  onMoreClick: (day: Date, events: DisplayEvent[], position: { x: number; y: number }) => void;
  onEventMove: (event: DisplayEvent, startAt: Date, endAt: Date) => void;
  onOpenTrip: (tripId: string) => void;
}

interface LaneBar {
  event: DisplayEvent;
  startCol: number;
  endCol: number;
  lane: number;
}

interface DragState {
  event: DisplayEvent;
  startX: number;
  deltaDays: number;
}

export default function MonthView({
  days,
  events,
  holidays,
  onDayClick,
  onDayNavigate,
  onEventClick,
  onMoreClick,
  onEventMove,
  onOpenTrip,
}: MonthViewProps) {
  const { t, i18n } = useTranslation();
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  const weekLayout = (week: Date[]): { bars: LaneBar[]; hiddenByDay: Map<string, number> } => {
    const weekStart = week[0]!;
    const weekEnd = addDays(weekStart, 7);
    const spans = events
      .map((event) => {
        const span = weekSpan(event, weekStart, weekEnd);
        return span ? { event, ...span } : null;
      })
      .filter((s): s is { event: DisplayEvent; startCol: number; endCol: number } => s !== null)
      .sort(
        (a, b) =>
          a.startCol - b.startCol || b.endCol - b.startCol - (a.endCol - a.startCol),
      );

    const laneEnds: number[] = [];
    const bars: LaneBar[] = [];
    const hiddenByDay = new Map<string, number>();
    for (const span of spans) {
      let lane = laneEnds.findIndex((end) => end < span.startCol);
      if (lane === -1) lane = laneEnds.length;
      if (lane >= MAX_LANES) {
        for (let col = span.startCol; col <= span.endCol; col += 1) {
          const key = dayKey(week[col]!);
          hiddenByDay.set(key, (hiddenByDay.get(key) ?? 0) + 1);
        }
        continue;
      }
      laneEnds[lane] = span.endCol;
      bars.push({ ...span, lane });
    }
    return { bars, hiddenByDay };
  };

  const beginDrag = (event: DisplayEvent, pointer: React.PointerEvent) => {
    if (event.readonly) return;
    pointer.preventDefault();
    suppressClick.current = false;
    setDrag({ event, startX: pointer.clientX, deltaDays: 0 });
    const onMove = (move: PointerEvent) => {
      const cellWidth = (gridRef.current?.clientWidth ?? 7 * 120) / 7;
      const deltaDays = Math.round((move.clientX - pointer.clientX) / cellWidth);
      if (deltaDays !== 0) suppressClick.current = true;
      setDrag((prev) => (prev ? { ...prev, deltaDays } : prev));
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag((prev) => {
        if (prev && prev.deltaDays !== 0) {
          onEventMove(
            prev.event,
            addDays(prev.event.startAt, prev.deltaDays),
            addDays(prev.event.endAt, prev.deltaDays),
          );
        }
        return null;
      });
      void up;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="month-view" ref={gridRef}>
      <div className="month-view__weekdays">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key}>{t(`calendar.weekdays.${key}`)}</span>
        ))}
      </div>
      {weeks.map((week) => {
        const { bars, hiddenByDay } = weekLayout(week);
        return (
          <div className="month-week" key={dayKey(week[0]!)}>
            <div className="month-week__cells">
              {week.map((day) => {
                const key = dayKey(day);
                const dayHolidays = holidays.get(key) ?? [];
                const dayOff = dayHolidays.find((h) => !h.isWorkday);
                const workday = dayHolidays.find((h) => h.isWorkday);
                const hiddenCount = hiddenByDay.get(key) ?? 0;
                return (
                  <div
                    key={key}
                    className={[
                      'month-cell',
                      day.getMonth() !== days[14]!.getMonth() ? 'month-cell--outside' : '',
                      sameDay(day, today) ? 'month-cell--today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    data-day={key}
                    onClick={(e) => {
                      // Create on empty-space clicks; bars/buttons handle themselves.
                      if ((e.target as HTMLElement).closest('button')) return;
                      onDayClick(day);
                    }}
                  >
                    <div className="month-cell__head">
                      <button
                        type="button"
                        className="month-cell__daynum"
                        onClick={() => onDayNavigate(day)}
                      >
                        {day.getDate()}
                      </button>
                      {workday && (
                        <span className="month-cell__workday">
                          {t('calendar.workdayBadge')}
                        </span>
                      )}
                    </div>
                    {dayOff && <div className="month-cell__holiday">{dayOff.name}</div>}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="month-cell__more"
                        onClick={(e) => {
                          const dayEvents = events.filter(
                            (ev) =>
                              weekSpan(ev, week[0]!, addDays(week[0]!, 7)) !== null &&
                              ev.startAt < addDays(day, 1) &&
                              ev.endAt > day,
                          );
                          onMoreClick(day, dayEvents, { x: e.clientX, y: e.clientY });
                        }}
                      >
                        {t('calendar.more', { count: hiddenCount })}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="month-week__lanes" style={{ height: MAX_LANES * 22 }}>
              {bars.map((bar) => {
                const isDragging = drag?.event.id === bar.event.id;
                const translateX = isDragging ? `${drag.deltaDays * (100 / 7)}%` : undefined;
                const label = bar.event.allDay
                  ? bar.event.title
                  : `${bar.event.startAt.toLocaleTimeString(i18n.language, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })} ${bar.event.title}`;
                return (
                  <button
                    key={`${bar.event.id}-${dayKey(week[bar.startCol]!)}`}
                    type="button"
                    className={[
                      'month-bar',
                      bar.event.kind === 'travel' ? 'month-bar--travel' : '',
                      bar.event.readonly ? 'month-bar--readonly' : '',
                      isDragging ? 'month-bar--dragging' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      left: `calc(${bar.startCol * (100 / 7)}% + 2px)`,
                      width: `calc(${(bar.endCol - bar.startCol + 1) * (100 / 7)}% - 4px)`,
                      top: bar.lane * 22,
                      backgroundColor: bar.event.color,
                      transform: translateX ? `translateX(${translateX})` : undefined,
                    }}
                    onPointerDown={(e) => beginDrag(bar.event, e)}
                    onClick={(e) => {
                      if (suppressClick.current) {
                        e.stopPropagation();
                        return;
                      }
                      if (bar.event.kind === 'travel' && bar.event.tripId) {
                        onOpenTrip(bar.event.tripId);
                      } else {
                        onEventClick(bar.event, { x: e.clientX, y: e.clientY });
                      }
                    }}
                  >
                    {label}
                    {bar.event.kind === 'travel' && (
                      <span className="month-bar__badge">{t('calendar.travelBadge')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
