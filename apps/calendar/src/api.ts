import type {
  ApiErrorBody,
  CreateMemoDto,
  MemoDto,
  MemoImageDto,
  MemoPriority,
  SetMemoCompletionDto,
  TagCountDto,
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
  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
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

export interface MemoListFilters {
  /** AND semantics: the memo must carry every listed tag (M2). */
  tags?: string[];
  /** OR semantics: the memo priority must be one of the listed values (M2). */
  priorities?: MemoPriority[];
}

export function listMemos(from: string, to: string, filters: MemoListFilters = {}): Promise<MemoDto[]> {
  const params = new URLSearchParams({ from, to });
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.priorities?.length) params.set('priorities', filters.priorities.join(','));
  return request(`/api/memos?${params.toString()}`);
}

/** Tag aggregate for the filter sidebar candidates (M2 D5). */
export function listMemoTags(): Promise<TagCountDto[]> {
  return request('/api/memos/tags');
}

/** Renames a tag across all memos; resolves to the fresh tag aggregate. */
export function renameMemoTag(from: string, to: string): Promise<TagCountDto[]> {
  return request('/api/memos/tags', json('PATCH', { from, to }));
}

/** Removes a tag from all memos; resolves to the fresh tag aggregate. */
export function deleteMemoTag(tag: string): Promise<TagCountDto[]> {
  return request(`/api/memos/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
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

// -- Memo images (M3): bodies live in object storage; metadata via API ------

export function listMemoImages(memoId: string): Promise<MemoImageDto[]> {
  return request(`/api/memos/${memoId}/images`);
}

/** Uploads one image as multipart; the client-generated id makes retries idempotent (E58). */
export async function uploadMemoImage(memoId: string, file: File): Promise<MemoImageDto> {
  const form = new FormData();
  form.set('id', crypto.randomUUID());
  form.set('file', file);
  let response: Response;
  try {
    response = await fetch(`/api/memos/${memoId}/images`, {
      method: 'POST',
      headers: authFetchHeaders(),
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  return handleResponse<MemoImageDto>(response);
}

export function deleteMemoImage(memoId: string, imageId: string): Promise<void> {
  return request(`/api/memos/${memoId}/images/${imageId}`, { method: 'DELETE' });
}

/** Fetches the image body through the authenticated API and returns a blob URL. */
export async function memoImageUrl(imageId: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/memos/images/${imageId}/file`, {
      headers: authFetchHeaders(),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  if (!response.ok) {
    handleAuthFailure(response.status);
    throw new ApiError(response.status, 'UNKNOWN', `HTTP ${response.status}`);
  }
  return URL.createObjectURL(await response.blob());
}
