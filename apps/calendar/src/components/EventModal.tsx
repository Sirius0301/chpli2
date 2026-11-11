import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CalendarDto,
  EventDto,
  ReminderDto,
  ReminderInput,
  ReminderPreset,
} from '@chpli2/shared';
import {
  REMINDER_OFFSET_MAX_DAYS,
  REMINDER_PRESET_OFFSET_DAYS,
  floatingWallToUtc,
  isValidTimezone,
  utcToFloatingWall,
  wallClockOf,
  wallClockToInput,
  zonedTimeToUtc,
} from '@chpli2/shared';
import { ApiError, listReminders } from '../api';
import {
  addMinutes,
  dateFromKey,
  parseLocalInput,
  toDateInput,
  toLocalInput,
} from '../dates';

const browserTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

/** Wall-clock input value for a stored instant under the event's semantics. */
function inputForInstant(iso: string, timezone: string | null, allDay: boolean): string {
  const instant = new Date(iso);
  if (allDay) return toDateInput(instant);
  if (timezone === null) return wallClockToInput(utcToFloatingWall(instant));
  return wallClockToInput(wallClockOf(instant, timezone));
}

export interface EventModalProps {
  mode: 'create' | 'edit';
  /** Pre-selected calendar for new events (the current calendar). */
  initialCalendarId: string;
  /** Initial slot for new events. */
  initialStart: Date;
  initialEnd: Date;
  initialAllDay: boolean;
  event?: EventDto;
  calendars: CalendarDto[];
  onSubmit: (values: {
    calendarId: string;
    title: string;
    /** ISO: offset-less wall time (timed) or UTC-midnight instant (all-day). */
    startAt: string;
    endAt: string;
    allDay: boolean;
    /** IANA name for a fixed-zone event; null = floating time (F4). */
    timezone: string | null;
    location: string | null;
    description: string | null;
    reminders: ReminderInput[];
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

interface ReminderRow {
  preset: ReminderPreset;
  offsetDays: number;
}

export default function EventModal({
  mode,
  initialCalendarId,
  initialStart,
  initialEnd,
  initialAllDay,
  event,
  calendars,
  onSubmit,
  onDelete,
  onClose,
}: EventModalProps) {
  const { t } = useTranslation();
  const isReadonly = mode === 'edit' && event !== undefined &&
    calendars.find((c) => c.id === event.calendarId)?.readonly === true;

  const [calendarId, setCalendarId] = useState(
    mode === 'edit' && event ? event.calendarId : initialCalendarId,
  );
  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? initialAllDay);
  const [timezone, setTimezone] = useState<string | null>(event?.timezone ?? browserTimezone());
  const timezones = useMemo(
    () => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []),
    [],
  );
  const [startInput, setStartInput] = useState(
    event
      ? inputForInstant(event.startAt, event.timezone, event.allDay)
      : initialAllDay
        ? toDateInput(initialStart)
        : toLocalInput(initialStart),
  );
  const [endInput, setEndInput] = useState(
    event
      ? event.allDay
        ? toDateInput(new Date(new Date(event.endAt).getTime() - 86_400_000))
        : inputForInstant(event.endAt, event.timezone, false)
      : initialAllDay
        ? toDateInput(initialEnd)
        : toLocalInput(initialEnd),
  );
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && event) {
      listReminders(event.id)
        .then((rows: ReminderDto[]) =>
          setReminders(rows.map((r) => ({ preset: r.preset, offsetDays: r.offsetDays }))),
        )
        .catch(() => setReminders([]));
    }
  }, [mode, event]);

  const parseInputs = (): { startAt: string; endAt: string } | { error: string } => {
    try {
      if (allDay) {
        const startDate = dateFromKey(startInput);
        const endDate = dateFromKey(endInput);
        if (endDate < startDate) return { error: t('calendar.eventModal.endBeforeStart') };
        // Apple semantics: stored end is the day after the last day (exclusive),
        // anchored at UTC midnight so the event does not drift with timezones (E6).
        return {
          startAt: new Date(
            Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
          ).toISOString(),
          endAt: new Date(
            Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) + 86_400_000,
          ).toISOString(),
        };
      }
      // Timed events submit offset-less wall clocks; the backend resolves them
      // in the event's timezone (fixed) or stores them as UTC wall (floating).
      const startWall = parseLocalInput(startInput);
      const endWall = parseLocalInput(endInput);
      if (Number.isNaN(startWall.getTime()) || Number.isNaN(endWall.getTime())) {
        return { error: t('error.VALIDATION_ERROR') };
      }
      const toComparable = (d: Date): number => {
        const wall = {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour: d.getHours(),
          minute: d.getMinutes(),
          second: d.getSeconds(),
        };
        if (timezone === null) return floatingWallToUtc(wall).getTime();
        if (!isValidTimezone(timezone)) return NaN;
        const resolved = zonedTimeToUtc(wall, timezone);
        if (!resolved) return NaN; // DST gap (E15), reported below
        return resolved.getTime();
      };
      const startMs = toComparable(startWall);
      const endMs = toComparable(endWall);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return { error: t('calendar.eventModal.timezoneGap') };
      }
      if (endMs <= startMs) return { error: t('calendar.eventModal.endBeforeStart') };
      return { startAt: startInput, endAt: endInput };
    } catch {
      return { error: t('error.VALIDATION_ERROR') };
    }
  };

  const invalidOffsets = reminders.filter(
    (r) =>
      r.offsetDays < 1 ||
      r.offsetDays > REMINDER_OFFSET_MAX_DAYS ||
      !Number.isInteger(r.offsetDays),
  );

  const handleSubmit = async () => {
    const parsed = parseInputs();
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    if (invalidOffsets.length > 0) {
      setError(t('calendar.eventModal.offsetMaxError'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        calendarId,
        title: title.trim(),
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        allDay,
        timezone,
        location: location.trim() ? location.trim() : null,
        description: description.trim() ? description.trim() : null,
        reminders: reminders.map((r) => ({
          preset: r.preset,
          offsetDays: r.preset === 'custom' ? r.offsetDays : REMINDER_PRESET_OFFSET_DAYS[r.preset],
        })),
      });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? t([`error.${submitError.errorCode}`, 'error.UNKNOWN'])
          : t('error.UNKNOWN'),
      );
      setBusy(false);
    }
  };

  const setPreset = (index: number, preset: ReminderPreset) => {
    setReminders((rows) =>
      rows.map((row, i) =>
        i === index ? { preset, offsetDays: REMINDER_PRESET_OFFSET_DAYS[preset] } : row,
      ),
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label={t(mode === 'create' ? 'calendar.eventModal.createTitle' : 'calendar.eventModal.editTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          {t(mode === 'create' ? 'calendar.eventModal.createTitle' : 'calendar.eventModal.editTitle')}
        </h3>
        {isReadonly && <p className="hint">{t('calendar.eventModal.readonlyHint')}</p>}
        {error && (
          <div className="calendar-error" role="alert">
            {error}
          </div>
        )}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <label className="form__row">
            <span>{t('calendar.eventModal.title')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReadonly}
              maxLength={256}
            />
          </label>
          <label className="form__row">
            <span>{t('calendar.eventModal.calendar')}</span>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              disabled={isReadonly}
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form__row form__row--inline">
            <input
              type="checkbox"
              checked={allDay}
              disabled={isReadonly}
              onChange={(e) => {
                const next = e.target.checked;
                setAllDay(next);
                if (next) {
                  setStartInput(toDateInput(parseLocalInput(startInput)));
                  setEndInput(toDateInput(parseLocalInput(endInput)));
                } else {
                  const start = parseLocalInput(startInput);
                  setStartInput(toLocalInput(start));
                  setEndInput(toLocalInput(addMinutes(start, 60)));
                }
              }}
            />
            <span>{t('calendar.eventModal.allDay')}</span>
          </label>
          <label className="form__row">
            <span>{t('calendar.eventModal.start')}</span>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={startInput}
              disabled={isReadonly}
              onChange={(e) => {
                setStartInput(e.target.value);
                if (!allDay) setEndInput(toLocalInput(addMinutes(parseLocalInput(e.target.value), 60)));
              }}
            />
          </label>
          <label className="form__row">
            <span>{allDay ? t('calendar.eventModal.date') : t('calendar.eventModal.end')}</span>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              value={endInput}
              disabled={isReadonly}
              onChange={(e) => setEndInput(e.target.value)}
            />
          </label>
          {!allDay && (
            <label className="form__row">
              <span>{t('calendar.eventModal.timezone')}</span>
              <select
                value={timezone ?? ''}
                disabled={isReadonly}
                onChange={(e) => setTimezone(e.target.value === '' ? null : e.target.value)}
              >
                <option value="">{t('calendar.eventModal.floating')}</option>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form__row">
            <span>{t('calendar.eventModal.location')}</span>
            <input
              type="text"
              value={location}
              disabled={isReadonly}
              maxLength={256}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label className="form__row">
            <span>{t('calendar.eventModal.description')}</span>
            <textarea
              value={description}
              disabled={isReadonly}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <fieldset className="form__row">
            <legend>{t('calendar.eventModal.reminders')}</legend>
            {reminders.map((row, index) => (
              <div key={index} className="reminder-row">
                <select
                  value={row.preset}
                  disabled={isReadonly}
                  onChange={(e) => setPreset(index, e.target.value as ReminderPreset)}
                >
                  <option value="month">{t('calendar.eventModal.preset.month')}</option>
                  <option value="week">{t('calendar.eventModal.preset.week')}</option>
                  <option value="day">{t('calendar.eventModal.preset.day')}</option>
                  <option value="custom">{t('calendar.eventModal.preset.custom')}</option>
                </select>
                {row.preset === 'custom' && (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={row.offsetDays}
                      disabled={isReadonly}
                      aria-label={t('calendar.eventModal.offsetDays')}
                      onChange={(e) =>
                        setReminders((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, offsetDays: Number(e.target.value) } : r,
                          ),
                        )
                      }
                    />
                    {row.offsetDays > REMINDER_OFFSET_MAX_DAYS && (
                      <span className="form__hint form__hint--error">
                        {t('calendar.eventModal.offsetMaxError')}
                      </span>
                    )}
                  </>
                )}
                {!isReadonly && (
                  <button
                    type="button"
                    className="button button--small"
                    aria-label={t('common.delete')}
                    onClick={() => setReminders((rows) => rows.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!isReadonly && (
              <button
                type="button"
                className="button button--small"
                onClick={() => setReminders((rows) => [...rows, { preset: 'day', offsetDays: 1 }])}
              >
                {t('calendar.eventModal.addReminder')}
              </button>
            )}
          </fieldset>

          <div className="modal__actions">
            {mode === 'edit' && onDelete && !isReadonly && !confirmDelete && (
              <button
                type="button"
                className="button button--danger"
                onClick={() => setConfirmDelete(true)}
              >
                {t('calendar.eventModal.deleteEvent')}
              </button>
            )}
            {mode === 'edit' && onDelete && !isReadonly && confirmDelete && (
              <>
                <span className="form__hint">
                  {t('calendar.eventModal.deleteConfirmTitle', {
                    title: title || t('calendar.untitled'),
                  })}
                </span>
                <button
                  type="button"
                  className="button button--danger"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    onDelete()
                      .catch(() => setBusy(false))
                      .finally(() => setConfirmDelete(false));
                  }}
                >
                  {t('common.confirm')}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t('common.cancel')}
                </button>
              </>
            )}
            <span className="modal__spacer" />
            <button type="button" className="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            {!isReadonly && (
              <button type="submit" className="button button--primary" disabled={busy}>
                {t('common.save')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
