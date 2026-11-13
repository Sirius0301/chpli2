import type { ApiErrorBody, BookmarkDto, BookmarkSort, CreateBookmarkDto, UpdateBookmarkDto } from '@chpli2/shared';
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: authFetchHeaders(init?.headers as Record<string, string> | undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  return handleResponse<T>(response);
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// -- Bookmarks -----------------------------------------------------------------

export function listBookmarks(sort: BookmarkSort = 'recent'): Promise<BookmarkDto[]> {
  return request(`/api/bookmarks?sort=${sort}`);
}

export function createBookmark(body: CreateBookmarkDto): Promise<BookmarkDto> {
  return request('/api/bookmarks', json('POST', body));
}

export function updateBookmark(id: string, body: UpdateBookmarkDto): Promise<BookmarkDto> {
  return request(`/api/bookmarks/${id}`, json('PATCH', body));
}

export function deleteBookmark(id: string): Promise<void> {
  return request(`/api/bookmarks/${id}`, { method: 'DELETE' });
}

/** Records a click and returns the updated bookmark (B1 D4). */
export function clickBookmark(id: string): Promise<BookmarkDto> {
  return request(`/api/bookmarks/${id}/click`, { method: 'POST' });
}

export async function uploadBookmarkCover(id: string, file: File): Promise<BookmarkDto> {
  const form = new FormData();
  form.set('file', file);
  let response: Response;
  try {
    response = await fetch(`/api/bookmarks/${id}/cover`, {
      method: 'PUT',
      headers: authFetchHeaders(),
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  return handleResponse<BookmarkDto>(response);
}

export async function bookmarkCoverUrl(id: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/bookmarks/${id}/cover/file`, {
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
