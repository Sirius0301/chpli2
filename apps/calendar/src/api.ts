import type {
  ApiErrorBody,
  CreateMemoDto,
  MemoDto,
  SetMemoCompletionDto,
  UpdateMemoDto,
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
    response = await fetch(path, {
      ...init,
      headers: authFetchHeaders(
        init?.headers as Record<string, string> | undefined,
      ),
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
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// -- Memos ------------------------------------------------------------------

export function listMemos(from: string, to: string): Promise<MemoDto[]> {
  const params = new URLSearchParams({ from, to });
  return request(`/api/memos?${params.toString()}`);
}

export function createMemo(body: CreateMemoDto): Promise<MemoDto> {
  return request('/api/memos', json('POST', body));
}

export function updateMemo(id: string, body: UpdateMemoDto): Promise<MemoDto> {
  return request(`/api/memos/${id}`, json('PATCH', body));
}

export function deleteMemo(id: string): Promise<void> {
  return request(`/api/memos/${id}`, { method: 'DELETE' });
}

export function setMemoCompletion(id: string, body: SetMemoCompletionDto): Promise<MemoDto> {
  return request(`/api/memos/${id}/completion`, json('PUT', body));
}
