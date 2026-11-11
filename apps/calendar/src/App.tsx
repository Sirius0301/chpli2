import './i18n';
import './styles.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CalendarDto,
  DueReminderDto,
  EventDto,
  HolidayEntryDto,
  ReminderInput,
} from '@chpli2/shared';
import {
  ApiError,
  createCalendar,
  createEvent,
  deleteCalendar,
  deleteEvent,
  getEvent,
  listCalendars,
  listDueReminders,
  listEvents,
  listHolidays,
  listTravelEvents,
  replaceReminders,
  updateCalendar,
  updateEvent,
} from './api';
import {
  addDays,
  addMinutes,
  dayKey,
  monthGrid,
  startOfDay,
  startOfWeek,
} from './dates';
import { displayEvent, type DisplayEvent } from './view-model';
import { holidayLang } from './i18n';
import Toolbar, { type ViewMode } from './components/Toolbar';
import Sidebar from './components/Sidebar';
import MonthView from './components/MonthView';
import WeekView from './components/WeekView';
import EventModal from './components/EventModal';
import { CalendarCreateModal, CalendarDeleteModal } from './components/CalendarModals';
import EventPopover, { DayEventsPopover } from './components/EventPopover';

/** Notifies the host app to switch to the Travel module and open this trip. */
export const OPEN_TRIP_EVENT = 'chpli2-open-trip';

interface WindowRange {
  from: Date;
  to: Date;
}

interface PopoverState {
  event: DisplayEvent;
  position: { x: number; y: number };
}

interface DayListState {
  day: Date;
  events: DisplayEvent[];
  position: { x: number; y: number };
}

type ModalState =
  | { kind: 'event-create'; start: Date; end: Date; allDay: boolean }
  | { kind: 'event-edit'; event: EventDto }
  | { kind: 'calendar-create' }
  | { kind: 'calendar-delete'; calendar: CalendarDto; eventCount: number }
  | null;

function windowFor(view: ViewMode, anchor: Date): { days: Date[]; range: WindowRange } {
  if (view === 'month') {
    const days = monthGrid(anchor);
    return {
      days,
      range: { from: startOfDay(days[0]!), to: addDays(startOfDay(days[41]!), 1) },
    };
  }
  const start = view === 'week' ? startOfWeek(anchor) : startOfDay(anchor);
  const days = Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => addDays(start, i));
  return { days, range: { from: startOfDay(days[0]!), to: addDays(startOfDay(days[days.length - 1]!), 1) } };
}

export default function CalendarApp() {
  const { t, i18n } = useTranslation();
  const [calendars, setCalendars] = useState<CalendarDto[] | null>(null);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [travelEvents, setTravelEvents] = useState<DisplayEvent[]>([]);
  const [holidays, setHolidays] = useState<Map<string, HolidayEntryDto[]>>(new Map());
  const [dueReminders, setDueReminders] = useState<DueReminderDto[]>([]);
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [modal, setModal] = useState<ModalState>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [dayList, setDayList] = useState<DayListState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const visibleCalendars = useMemo(
    () => (calendars ?? []).filter((c) => !c.hidden),
    [calendars],
  );
  const visibleCustomIds = useMemo(
    () => visibleCalendars.filter((c) => !c.readonly).map((c) => c.id),
    [visibleCalendars],
  );
  const calendarColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of calendars ?? []) map.set(c.id, c.color);
    return map;
  }, [calendars]);

  const { days, range } = useMemo(() => windowFor(view, anchor), [view, anchor]);
  const rangeKey = `${dayKey(range.from)}/${dayKey(range.to)}`;

  const reloadCalendars = useCallback(async () => {
    setCalendars(await listCalendars());
  }, []);

  const reloadDueReminders = useCallback(
    async (ids: string[]) => {
      const farFuture = new Date(Date.now() + 366 * 86_400_000).toISOString();
      setDueReminders(await listDueReminders(farFuture, ids));
    },
    [],
  );

  const reloadEvents = useCallback(
    async (from: Date, to: Date, ids: string[]) => {
      const [userEvents, travel] = await Promise.all([
        listEvents(from.toISOString(), to.toISOString(), ids),
        listTravelEvents(from.toISOString(), to.toISOString()),
      ]);
      setEvents(userEvents);
      setTravelEvents(
        travel.map((te) => ({
          id: `travel:${te.id}`,
          title: te.title,
          startAt: new Date(te.startsAt),
          endAt: new Date(te.endsAt),
          allDay: false,
          color: '#8E8E93',
          calendarId: '',
          kind: 'travel' as const,
          readonly: true,
          tripId: te.source.tripId,
        })),
      );
    },
    [],
  );

  // Initial load: calendars first, then everything else.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cals = await listCalendars();
        if (cancelled) return;
        setCalendars(cals);
        const ids = cals.filter((c) => !c.hidden && !c.readonly).map((c) => c.id);
        const { range: r } = windowFor('month', new Date());
        await Promise.all([
          reloadEvents(r.from, r.to, ids),
          reloadDueReminders(ids),
        ]);
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when the view window or visible calendars change.
  useEffect(() => {
    if (!calendars) return;
    let cancelled = false;
    (async () => {
      try {
        await reloadEvents(range.from, range.to, visibleCustomIds);
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, visibleCustomIds.join(','), calendars === null]);

  // Holidays depend on the window, the visible subscriptions and the language.
  useEffect(() => {
    if (!calendars) return;
    const regionCodes = visibleCalendars.filter((c) => c.readonly && c.regionCode).map((c) => c.regionCode!);
    let cancelled = false;
    listHolidays(regionCodes, dayKey(range.from), dayKey(addDays(range.to, -1)), holidayLang(i18n.language))
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, HolidayEntryDto[]>();
        for (const row of rows) {
          const bucket = map.get(row.date);
          if (bucket) bucket.push(row);
          else map.set(row.date, [row]);
        }
        setHolidays(map);
      })
      .catch(() => {
        /* holiday layers degrade silently (E9) */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, calendars, i18n.language]);

  const refreshAll = useCallback(async () => {
    const ids = visibleCustomIds;
    await Promise.all([
      reloadEvents(range.from, range.to, ids),
      reloadDueReminders(ids),
    ]);
  }, [range, visibleCustomIds, reloadEvents, reloadDueReminders]);

  const displayEvents = useMemo<DisplayEvent[]>(() => {
    const userEvents = events.map((e) => displayEvent(e, calendarColor.get(e.calendarId) ?? '#0A84FF'));
    return [...userEvents, ...travelEvents].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );
  }, [events, travelEvents, calendarColor]);

  const defaultCalendarId =
    calendars?.find((c) => c.isDefault && !c.readonly)?.id ??
    calendars?.find((c) => !c.readonly)?.id ??
    '';

  // -- Navigation --------------------------------------------------------------

  const navigate = (direction: -1 | 1) => {
    setAnchor((prev) => {
      if (view === 'month') return new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      return addDays(prev, direction * (view === 'week' ? 7 : 1));
    });
  };

  const openTrip = (tripId: string) => {
    window.dispatchEvent(new CustomEvent(OPEN_TRIP_EVENT, { detail: { tripId } }));
  };

  // -- Mutations -----------------------------------------------------------------

  const handleToggleHidden = async (calendar: CalendarDto) => {
    await updateCalendar(calendar.id, { hidden: !calendar.hidden });
    await reloadCalendars();
    await refreshAll();
  };

  const handleCreateCalendar = async (values: {
    name: string;
    color: string;
    type: 'custom' | 'subscription';
    regionCode: string | null;
  }) => {
    await createCalendar(values);
    setModal(null);
    await reloadCalendars();
  };

  const handleDeleteCalendar = async (calendar: CalendarDto) => {
    const all = await listEvents(
      new Date(Date.UTC(1970, 0, 1)).toISOString(),
      new Date(Date.UTC(2100, 0, 1)).toISOString(),
      [calendar.id],
    );
    setModal({ kind: 'calendar-delete', calendar, eventCount: all.length });
  };

  const handleConfirmDeleteCalendar = async (
    target: { moveTo: string } | { deleteEvents: true },
  ) => {
    if (!modal || modal.kind !== 'calendar-delete') return;
    if ('moveTo' in target) {
      await deleteCalendar(modal.calendar.id, target.moveTo);
    } else {
      await deleteCalendar(modal.calendar.id, undefined, true);
    }
    setModal(null);
    await reloadCalendars();
    await refreshAll();
  };

  const persistReminders = async (eventId: string, inputs: ReminderInput[]) => {
    if (inputs.length) await replaceReminders(eventId, inputs);
  };

  const handleSubmitEvent = async (values: {
    calendarId: string;
    title: string;
    startAt: Date;
    endAt: Date;
    allDay: boolean;
    timezone: string;
    location: string | null;
    description: string | null;
    reminders: ReminderInput[];
  }) => {
    if (modal?.kind === 'event-edit' && modal.event) {
      const updated = await updateEvent(modal.event.id, {
        calendarId: values.calendarId,
        title: values.title,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt.toISOString(),
        allDay: values.allDay,
        timezone: values.timezone,
        location: values.location,
        description: values.description,
        updatedAt: modal.event.updatedAt,
      });
      await persistReminders(updated.id, values.reminders);
      setModal(null);
    } else {
      const id = crypto.randomUUID();
      const created = await createEvent({
        id,
        calendarId: values.calendarId,
        title: values.title,
        startAt: values.startAt.toISOString(),
        endAt: values.endAt.toISOString(),
        allDay: values.allDay,
        timezone: values.timezone,
        location: values.location,
        description: values.description,
      });
      await persistReminders(created.id, values.reminders);
      setModal(null);
    }
    setPopover(null);
    await refreshAll();
  };

  const handleDeleteEvent = async () => {
    if (modal?.kind === 'event-edit') {
      await deleteEvent(modal.event.id);
      setModal(null);
      setPopover(null);
      await refreshAll();
    }
  };

  const handleMoveEvent = async (moved: DisplayEvent, startAt: Date, endAt: Date) => {
    if (!moved.source) return;
    try {
      await updateEvent(moved.source.id, {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        updatedAt: moved.source.updatedAt,
      });
    } catch {
      /* 409: someone else edited it; reload restores the truth */
    }
    await refreshAll();
  };

  const handleOpenDueReminder = async (eventId: string) => {
    try {
      const event = await getEvent(eventId);
      setAnchor(new Date(event.startAt));
      setView('day');
      setPopover(null);
      setModal({ kind: 'event-edit', event });
    } catch {
      setLoadError('UNKNOWN');
    }
  };

  // -- Render ----------------------------------------------------------------------

  if (calendars === null && loadError) {
    return (
      <section>
        <h2>{t('calendar.sidebar.calendars')}</h2>
        <div className="calendar-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            {t('common.retry')}
          </button>
        </div>
      </section>
    );
  }

  if (calendars === null) {
    return <p className="loading">{t('common.loading')}</p>;
  }

  const title =
    view === 'month'
      ? anchor.toLocaleString(i18n.language, { year: 'numeric', month: 'long' })
      : days[0]!.toLocaleString(i18n.language, {
          month: 'long',
          day: 'numeric',
          ...(view === 'week' ? { year: 'numeric' } : {}),
        }) +
        (view === 'week' ? ` – ${days[6]!.getDate()}` : '');

  const createAt = (day: Date, minutes: number) => {
    const start = new Date(day);
    start.setHours(0, minutes, 0, 0);
    setPopover(null);
    setModal({
      kind: 'event-create',
      start,
      end: addMinutes(start, 60),
      allDay: false,
    });
  };

  return (
    <section className="cal-app">
      <Toolbar
        title={title}
        view={view}
        onViewChange={setView}
        onNavigate={navigate}
        onToday={() => setAnchor(new Date())}
      />
      {loadError && (
        <div className="calendar-error" role="alert">
          <p>{t([`error.${loadError}`, 'error.UNKNOWN'])}</p>
          <button type="button" className="button" onClick={() => void refreshAll().then(() => setLoadError(null))}>
            {t('common.retry')}
          </button>
        </div>
      )}
      <div className="cal-body">
        <Sidebar
          calendars={calendars}
          anchor={anchor}
          dueReminders={dueReminders}
          onAnchorChange={setAnchor}
          onToggleHidden={(c) => void handleToggleHidden(c)}
          onAddCalendar={() => setModal({ kind: 'calendar-create' })}
          onDeleteCalendar={(c) => void handleDeleteCalendar(c)}
          onOpenEvent={(id) => void handleOpenDueReminder(id)}
        />
        <div className="cal-main">
          {view === 'month' ? (
            <MonthView
              days={days}
              events={displayEvents}
              holidays={holidays}
              onDayClick={(day) => createAt(day, 9 * 60)}
              onDayNavigate={(day) => {
                setAnchor(day);
                setView('day');
              }}
              onEventClick={(event, position) => {
                setDayList(null);
                setPopover({ event, position });
              }}
              onMoreClick={(day, dayEvents, position) => {
                setPopover(null);
                setDayList({ day, events: dayEvents, position });
              }}
              onEventMove={(event, startAt, endAt) => void handleMoveEvent(event, startAt, endAt)}
              onOpenTrip={openTrip}
            />
          ) : (
            <WeekView
              days={days}
              events={displayEvents}
              holidays={holidays}
              onSlotClick={(day, minutes) => createAt(day, minutes)}
              onEventClick={(event, position) => {
                setDayList(null);
                setPopover({ event, position });
              }}
              onEventMove={(event, startAt, endAt) => void handleMoveEvent(event, startAt, endAt)}
              onOpenTrip={openTrip}
            />
          )}
        </div>
      </div>

      {popover && (
        <EventPopover
          event={popover.event}
          position={popover.position}
          onClose={() => setPopover(null)}
          onEdit={() => {
            const source = popover.event.source;
            setPopover(null);
            if (source) setModal({ kind: 'event-edit', event: source });
          }}
          onDelete={() => {
            const source = popover.event.source;
            setPopover(null);
            if (source) {
              void deleteEvent(source.id).then(() => refreshAll());
            }
          }}
        />
      )}

      {dayList && (
        <DayEventsPopover
          day={dayList.day}
          events={dayList.events}
          position={dayList.position}
          onClose={() => setDayList(null)}
          onSelect={(event) => {
            setDayList(null);
            if (event.kind === 'travel' && event.tripId) {
              openTrip(event.tripId);
            } else if (event.source) {
              setModal({ kind: 'event-edit', event: event.source });
            }
          }}
        />
      )}

      {modal?.kind === 'event-create' && (
        <EventModal
          mode="create"
          initialCalendarId={defaultCalendarId}
          initialStart={modal.start}
          initialEnd={modal.end}
          initialAllDay={modal.allDay}
          calendars={calendars}
          onSubmit={handleSubmitEvent}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'event-edit' && (
        <EventModal
          mode="edit"
          event={modal.event}
          initialCalendarId={modal.event.calendarId}
          initialStart={new Date(modal.event.startAt)}
          initialEnd={new Date(modal.event.endAt)}
          initialAllDay={modal.event.allDay}
          calendars={calendars}
          onSubmit={handleSubmitEvent}
          onDelete={() => handleDeleteEvent()}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'calendar-create' && (
        <CalendarCreateModal onSubmit={handleCreateCalendar} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'calendar-delete' && (
        <CalendarDeleteModal
          calendar={modal.calendar}
          eventCount={modal.eventCount}
          otherCalendars={calendars.filter((c) => c.id !== modal.calendar.id)}
          onConfirm={handleConfirmDeleteCalendar}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
