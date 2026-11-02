import { useTranslation } from 'react-i18next';
import type { TransportDto } from '@chpli2/shared';
import { formatDateTime } from '../utils/datetime';

interface TransportListProps {
  transports: TransportDto[];
  onEdit: (transport: TransportDto) => void;
  onDelete: (transport: TransportDto) => void;
}

export default function TransportList({
  transports,
  onEdit,
  onDelete,
}: TransportListProps) {
  const { t, i18n } = useTranslation();

  const timeRow = (label: string, iso: string | null) =>
    iso ? (
      <div className="transport-item__time" key={label}>
        <dt>{label}</dt>
        <dd>{formatDateTime(iso, i18n.language)}</dd>
      </div>
    ) : null;

  return (
    <ul className="transport-list">
      {transports.map((transport) => (
        <li className="transport-item" key={transport.id}>
          <div className="transport-item__header">
            <span className="badge badge--mode">
              {t(`transport.mode.${transport.mode}`)}
            </span>
            {transport.calendarSync && (
              <span className="badge badge--sync">
                {t(`transport.sync.${transport.calendarSync.status}`)}
              </span>
            )}
          </div>
          <div className="transport-item__route">
            {transport.origin.name}
            <span className="transport-item__arrow">→</span>
            {transport.destination.name}
          </div>
          <dl className="transport-item__times">
            {timeRow(t('transport.plannedDeparture'), transport.plannedDepartureAt)}
            {timeRow(t('transport.plannedArrival'), transport.plannedArrivalAt)}
            {timeRow(t('transport.actualDeparture'), transport.actualDepartureAt)}
            {timeRow(t('transport.actualArrival'), transport.actualArrivalAt)}
          </dl>
          <div className="transport-item__actions">
            <button
              type="button"
              className="button"
              onClick={() => onEdit(transport)}
            >
              {t('transport.edit')}
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => onDelete(transport)}
            >
              {t('transport.delete')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
