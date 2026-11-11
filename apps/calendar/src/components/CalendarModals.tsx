import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarDto } from '@chpli2/shared';
import { HOLIDAY_REGION_CODES } from '@chpli2/shared';
import { ApiError } from '../api';

const CALENDAR_COLORS = [
  '#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#8E8E93', '#FFD60A',
];

const DE_STATES = HOLIDAY_REGION_CODES.filter((r) => r.startsWith('DE-'));
const CH_CANTONS = HOLIDAY_REGION_CODES.filter((r) => r.startsWith('CH-'));

interface CalendarModalProps {
  onSubmit: (values: { name: string; color: string; type: 'custom' | 'subscription'; regionCode: string | null }) => Promise<void>;
  onClose: () => void;
}

export function CalendarCreateModal({ onSubmit, onClose }: CalendarModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState(CALENDAR_COLORS[0]!);
  const [type, setType] = useState<'custom' | 'subscription'>('custom');
  const [regionCode, setRegionCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        color,
        type,
        regionCode: type === 'subscription' ? regionCode : null,
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label={t('calendar.calendarModal.createTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t('calendar.calendarModal.createTitle')}</h3>
        {error && (
          <div className="calendar-error" role="alert">
            {error}
          </div>
        )}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="form__row">
            <span>{t('calendar.calendarModal.type')}</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'custom' | 'subscription')}
            >
              <option value="custom">{t('calendar.calendarModal.typeCustom')}</option>
              <option value="subscription">{t('calendar.calendarModal.typeSubscription')}</option>
            </select>
          </label>
          <label className="form__row">
            <span>{t('calendar.calendarModal.name')}</span>
            <input
              type="text"
              value={name}
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {type === 'subscription' && (
            <label className="form__row">
              <span>{t('calendar.calendarModal.region')}</span>
              <select value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
                <option value="">{t('calendar.calendarModal.regionPrompt')}</option>
                <option value="CN">{t('calendar.calendarModal.regionCN')}</option>
                <optgroup label={t('calendar.calendarModal.regionDE')}>
                  {DE_STATES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('calendar.calendarModal.regionCH')}>
                  {CH_CANTONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}
          <div className="form__row">
            <span>{t('calendar.calendarModal.color')}</span>
            <div className="color-picker">
              {CALENDAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={c === color ? 'color-dot color-dot--selected' : 'color-dot'}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="modal__actions">
            <span className="modal__spacer" />
            <button type="button" className="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={busy || !name.trim() || (type === 'subscription' && !regionCode)}
            >
              {t('calendar.calendarModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CalendarDeleteModalProps {
  calendar: CalendarDto;
  /** Number of active events in the calendar (fetched by the caller). */
  eventCount: number;
  otherCalendars: CalendarDto[];
  onConfirm: (target: { moveTo: string } | { deleteEvents: true }) => Promise<void>;
  onClose: () => void;
}

export function CalendarDeleteModal({
  calendar,
  eventCount,
  otherCalendars,
  onConfirm,
  onClose,
}: CalendarDeleteModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targets = otherCalendars.filter((c) => !c.readonly);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(mode === 'move' ? { moveTo } : { deleteEvents: true });
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? t([`error.${submitError.errorCode}`, 'error.UNKNOWN'])
          : t('error.UNKNOWN'),
      );
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label={t('calendar.deleteCalendar.title', { name: calendar.name })}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t('calendar.deleteCalendar.title', { name: calendar.name })}</h3>
        {error && (
          <div className="calendar-error" role="alert">
            {error}
          </div>
        )}
        {eventCount > 0 ? (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p>{t('calendar.deleteCalendar.hasEvents', { count: eventCount })}</p>
            <label className="form__row">
              <input
                type="radio"
                name="cal-delete"
                checked={mode === 'move'}
                onChange={() => setMode('move')}
              />
              <span>{t('calendar.deleteCalendar.moveTo')}</span>
              <select
                value={moveTo}
                disabled={mode !== 'move'}
                onChange={(e) => setMoveTo(e.target.value)}
              >
                <option value="">{t('calendar.calendarModal.regionPrompt')}</option>
                {targets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {calendar.type !== 'custom' ? null : (
              <label className="form__row">
                <input
                  type="radio"
                  name="cal-delete"
                  checked={mode === 'delete'}
                  onChange={() => setMode('delete')}
                />
                <span>{t('calendar.deleteCalendar.deleteEvents')}</span>
              </label>
            )}
            <div className="modal__actions">
              <span className="modal__spacer" />
              <button type="button" className="button" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="button button--danger"
                disabled={busy || (mode === 'move' && !moveTo)}
              >
                {t('common.delete')}
              </button>
            </div>
          </form>
        ) : (
          <div className="form">
            <p>{t('calendar.deleteCalendar.empty')}</p>
            <div className="modal__actions">
              <span className="modal__spacer" />
              <button type="button" className="button" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => void submit()}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
