import type {
  ApiErrorBody,
  CityDto,
  CountryDto,
  CreateTransportDto,
  CreateTripDto,
  LocationDto,
  TransportDto,
  TripDto,
  UpdateTransportDto,
} from '@chpli2/shared';
import { authFetchHeaders, handleAuthFailure } from '@chpli2/shared';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: authFetchHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }

  if (!response.ok) {
    handleAuthFailure(response.status);
    let errorCode = 'UNKNOWN';
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      errorCode = typeof body.errorCode === 'string' ? body.errorCode : errorCode;
      message = typeof body.message === 'string' ? body.message : message;
    } catch {
      /* body was not JSON; keep defaults */
    }
    throw new ApiError(response.status, errorCode, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  listCountries: () => request<CountryDto[]>('/travel/countries'),
  listCities: (countryId: string) =>
    request<CityDto[]>(`/travel/countries/${countryId}/cities`),
  listLocations: (cityId: string) =>
    request<LocationDto[]>(`/travel/cities/${cityId}/locations`),
  createTrip: (body: CreateTripDto) =>
    request<TripDto>('/travel/trips', { method: 'POST', body: JSON.stringify(body) }),
  getTrip: (id: string) => request<TripDto>(`/travel/trips/${id}`),
  createTransport: (tripId: string, body: CreateTransportDto) =>
    request<TransportDto>(`/travel/trips/${tripId}/transports`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTransport: (id: string, body: UpdateTransportDto) =>
    request<TransportDto>(`/travel/transports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteTransport: (id: string) =>
    request<void>(`/travel/transports/${id}`, { method: 'DELETE' }),
};
