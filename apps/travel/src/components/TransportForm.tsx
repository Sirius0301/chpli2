import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '@chpli2/ui';
import {
  ROUTE_LEVELS,
  TRANSPORT_MODES,
  isActualTimeOrderValid,
  isPlannedTimeOrderValid,
  validateRoute,
  type CityDto,
  type CountryDto,
  type LocationDto,
  type RouteEndpointDto,
  type RouteLevel,
  type TransportDto,
  type TransportMode,
  type TripDto,
} from '@chpli2/shared';
import { api, ApiError } from '../api';
import { datetimeLocalToIso, isoToDatetimeLocal } from '../utils/datetime';

interface EndpointSelection {
  level: RouteLevel;
  countryId: string;
  cityId: string;
  /** The selected entity id: country id, city id or location id depending on level. */
  endpointId: string;
}

const emptySelection = (level: RouteLevel = 'COUNTRY'): EndpointSelection => ({
  level,
  countryId: '',
  cityId: '',
  endpointId: '',
});

function selectionFromEndpoint(endpoint: RouteEndpointDto): EndpointSelection {
  if (endpoint.level === 'COUNTRY') {
    return {
      level: 'COUNTRY',
      countryId: endpoint.id,
      cityId: '',
      endpointId: endpoint.id,
    };
  }
  // Country (and city) of the chain are resolved asynchronously on mount.
  return {
    level: endpoint.level,
    countryId: '',
    cityId: endpoint.cityId ?? '',
    endpointId: endpoint.id,
  };
}

interface TransportFormProps {
  trip: TripDto;
  editing?: TransportDto | null;
  onSaved: () => void;
  onCancelEdit?: () => void;
}

export default function TransportForm({
  trip,
  editing = null,
  onSaved,
  onCancelEdit,
}: TransportFormProps) {
  const { t } = useTranslation();

  const [mode, setMode] = useState<TransportMode>(editing?.mode ?? 'FLIGHT');
  const [origin, setOrigin] = useState<EndpointSelection>(() =>
    editing ? selectionFromEndpoint(editing.origin) : emptySelection(),
  );
  const [destination, setDestination] = useState<EndpointSelection>(() =>
    editing ? selectionFromEndpoint(editing.destination) : emptySelection(),
  );
  const [plannedDeparture, setPlannedDeparture] = useState(() =>
    isoToDatetimeLocal(editing?.plannedDepartureAt),
  );
  const [plannedArrival, setPlannedArrival] = useState(() =>
    isoToDatetimeLocal(editing?.plannedArrivalAt),
  );
  const [actualDeparture, setActualDeparture] = useState(() =>
    isoToDatetimeLocal(editing?.actualDepartureAt),
  );
  const [actualArrival, setActualArrival] = useState(() =>
    isoToDatetimeLocal(editing?.actualArrivalAt),
  );
  const [syncToCalendar, setSyncToCalendar] = useState(() =>
    editing ? editing.calendarSync !== null : true,
  );
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Geo data with cache-by-id so cascades load only once per entity.
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const citiesRef = useRef<Record<string, CityDto[]>>({});
  const locationsRef = useRef<Record<string, LocationDto[]>>({});
  const [, bumpGeo] = useState(0);

  const ensureCities = useCallback(async (countryId: string) => {
    if (countryId && !citiesRef.current[countryId]) {
      citiesRef.current[countryId] = await api.listCities(countryId);
      bumpGeo((v) => v + 1);
    }
    return citiesRef.current[countryId] ?? [];
  }, []);

  const ensureLocations = useCallback(async (cityId: string) => {
    if (cityId && !locationsRef.current[cityId]) {
      locationsRef.current[cityId] = await api.listLocations(cityId);
      bumpGeo((v) => v + 1);
    }
    return locationsRef.current[cityId] ?? [];
  }, []);

  // Resolve the country/city chain of an existing endpoint when editing.
  const resolveChain = useCallback(
    async (
      endpoint: RouteEndpointDto,
      apply: (selection: EndpointSelection) => void,
      loadedCountries: CountryDto[],
    ) => {
      if (endpoint.level === 'COUNTRY') {
        apply({
          level: 'COUNTRY',
          countryId: endpoint.id,
          cityId: '',
          endpointId: endpoint.id,
        });
        return;
      }
      for (const country of loadedCountries) {
        const cities = await ensureCities(country.id);
        if (endpoint.level === 'CITY') {
          if (cities.some((city) => city.id === endpoint.id)) {
            apply({
              level: 'CITY',
              countryId: country.id,
              cityId: endpoint.id,
              endpointId: endpoint.id,
            });
            return;
          }
        } else if (endpoint.cityId && cities.some((c) => c.id === endpoint.cityId)) {
          await ensureLocations(endpoint.cityId);
          apply({
            level: 'LOCATION',
            countryId: country.id,
            cityId: endpoint.cityId,
            endpointId: endpoint.id,
          });
          return;
        }
      }
    },
    [ensureCities, ensureLocations],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loadedCountries = await api.listCountries();
      if (cancelled) return;
      setCountries(loadedCountries);
      if (editing) {
        await resolveChain(editing.origin, setOrigin, loadedCountries);
        if (cancelled) return;
        await resolveChain(editing.destination, setDestination, loadedCountries);
      }
    })().catch(() => {
      /* geo load failure is surfaced by empty selects */
    });
    return () => {
      cancelled = true;
    };
  }, [editing, resolveChain]);

  const updateEndpoint = (
    setter: (selection: EndpointSelection) => void,
    current: EndpointSelection,
    patch: Partial<EndpointSelection>,
  ) => {
    setDirty(true);
    setter({ ...current, ...patch });
  };

  const originRef = origin.endpointId
    ? { level: origin.level, id: origin.endpointId }
    : null;
  const destinationRef = destination.endpointId
    ? { level: destination.level, id: destination.endpointId }
    : null;

  let routeError: string | null = null;
  if (originRef && destinationRef) {
    const result = validateRoute(originRef, destinationRef, {
      originCityId:
        origin.level === 'LOCATION' ? origin.cityId || undefined : undefined,
      destinationCityId:
        destination.level === 'LOCATION'
          ? destination.cityId || undefined
          : undefined,
    });
    if (!result.ok) routeError = result.code;
  }

  const plannedDepartureIso = datetimeLocalToIso(plannedDeparture);
  const plannedArrivalIso = datetimeLocalToIso(plannedArrival);
  const actualDepartureIso = datetimeLocalToIso(actualDeparture);
  const actualArrivalIso = datetimeLocalToIso(actualArrival);
  const timeOrderInvalid =
    !isPlannedTimeOrderValid(plannedDepartureIso, plannedArrivalIso) ||
    !isActualTimeOrderValid(actualDepartureIso, actualArrivalIso);

  const endpointsComplete = originRef !== null && destinationRef !== null;
  const canSubmit =
    !submitting && endpointsComplete && routeError === null && !timeOrderInvalid;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setDirty(true);
    if (!canSubmit || !originRef || !destinationRef) return;
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      mode,
      origin: originRef,
      destination: destinationRef,
      plannedDepartureAt: plannedDepartureIso,
      plannedArrivalAt: plannedArrivalIso,
      actualDepartureAt: actualDepartureIso,
      actualArrivalAt: actualArrivalIso,
      syncToCalendar: trip.type === 'PLAN' ? syncToCalendar : false,
    };
    try {
      if (editing) {
        await api.updateTransport(editing.id, payload);
      } else {
        await api.createTransport(trip.id, payload);
      }
      onSaved();
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.errorCode : 'UNKNOWN');
    } finally {
      setSubmitting(false);
    }
  };

  const renderEndpoint = (
    label: string,
    selection: EndpointSelection,
    setter: (selection: EndpointSelection) => void,
  ): ReactNode => {
    const cities = selection.countryId
      ? (citiesRef.current[selection.countryId] ?? [])
      : [];
    const locations = selection.cityId
      ? (locationsRef.current[selection.cityId] ?? [])
      : [];
    return (
      <fieldset className="endpoint">
        <legend>{label}</legend>
        <label className="field">
          <span>{t('transport.levelLabel')}</span>
          <Select
            aria-label={`${label} ${t('transport.levelLabel')}`}
            value={selection.level}
            onChange={(event) =>
              updateEndpoint(setter, selection, {
                level: event.target.value as RouteLevel,
                countryId: '',
                cityId: '',
                endpointId: '',
              })
            }
          >
            {ROUTE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`transport.level.${level}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span>{t('transport.level.COUNTRY')}</span>
          <Select
            aria-label={`${label} ${t('transport.level.COUNTRY')}`}
            value={selection.countryId}
            onChange={(event) => {
              const countryId = event.target.value;
              if (countryId) void ensureCities(countryId);
              updateEndpoint(setter, selection, {
                countryId,
                cityId: '',
                endpointId: selection.level === 'COUNTRY' ? countryId : '',
              });
            }}
          >
            <option value="">{t('transport.countryPlaceholder')}</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
        </label>
        {selection.level !== 'COUNTRY' && (
          <label className="field">
            <span>{t('transport.level.CITY')}</span>
            <Select
              aria-label={`${label} ${t('transport.level.CITY')}`}
              value={selection.cityId}
              onChange={(event) => {
                const cityId = event.target.value;
                if (selection.level === 'LOCATION' && cityId) {
                  void ensureLocations(cityId);
                }
                updateEndpoint(setter, selection, {
                  cityId,
                  endpointId: selection.level === 'CITY' ? cityId : '',
                });
              }}
            >
              <option value="">{t('transport.cityPlaceholder')}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {selection.level === 'LOCATION' && (
          <label className="field">
            <span>{t('transport.level.LOCATION')}</span>
            <Select
              aria-label={`${label} ${t('transport.level.LOCATION')}`}
              value={selection.endpointId}
              onChange={(event) =>
                updateEndpoint(setter, selection, { endpointId: event.target.value })
              }
            >
              <option value="">{t('transport.locationPlaceholder')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </Select>
          </label>
        )}
      </fieldset>
    );
  };

  const timeField = (
    label: string,
    value: string,
    setter: (value: string) => void,
  ) => (
    <label className="field">
      <span>{label}</span>
      <Input
        type="datetime-local"
        aria-label={label}
        value={value}
        onChange={(event) => {
          setDirty(true);
          setter(event.target.value);
        }}
      />
    </label>
  );

  return (
    <form className="transport-form" onSubmit={(event) => void handleSubmit(event)}>
      <h3>{t(editing ? 'transport.editTitle' : 'transport.addTitle')}</h3>
      <label className="field">
        <span>{t('transport.modeLabel')}</span>
        <Select
          aria-label={t('transport.modeLabel')}
          value={mode}
          onChange={(event) => {
            setDirty(true);
            setMode(event.target.value as TransportMode);
          }}
        >
          {TRANSPORT_MODES.map((transportMode) => (
            <option key={transportMode} value={transportMode}>
              {t(`transport.mode.${transportMode}`)}
            </option>
          ))}
        </Select>
      </label>
      <div className="endpoint-grid">
        {renderEndpoint(t('transport.origin'), origin, setOrigin)}
        {renderEndpoint(t('transport.destination'), destination, setDestination)}
      </div>
      <div className="time-grid">
        {timeField(t('transport.plannedDeparture'), plannedDeparture, setPlannedDeparture)}
        {timeField(t('transport.plannedArrival'), plannedArrival, setPlannedArrival)}
        {timeField(t('transport.actualDeparture'), actualDeparture, setActualDeparture)}
        {timeField(t('transport.actualArrival'), actualArrival, setActualArrival)}
      </div>
      {trip.type === 'PLAN' && (
        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={syncToCalendar}
            onChange={(event) => {
              setDirty(true);
              setSyncToCalendar(event.target.checked);
            }}
          />
          <span>{t('transport.syncToCalendar')}</span>
        </label>
      )}
      {dirty && !endpointsComplete && (
        <p className="form-error" role="alert">
          {t('validation.ENDPOINT_REQUIRED')}
        </p>
      )}
      {dirty && routeError && (
        <p className="form-error" role="alert">
          {t(`error.${routeError}`)}
        </p>
      )}
      {timeOrderInvalid && (
        <p className="form-error" role="alert">
          {t('error.TIME_ORDER_INVALID')}
        </p>
      )}
      {submitError && (
        <p className="form-error" role="alert">
          {t([`error.${submitError}`, 'error.UNKNOWN'])}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {t(submitting ? 'transport.submitting' : editing ? 'transport.submitEdit' : 'transport.submitAdd')}
        </Button>
        {editing && onCancelEdit && (
          <Button onClick={onCancelEdit}>{t('transport.cancelEdit')}</Button>
        )}
      </div>
    </form>
  );
}
