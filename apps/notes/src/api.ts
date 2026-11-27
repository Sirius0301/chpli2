import type {
  ApiErrorBody,
  CreateNoteDto,
  NoteDto,
  NoteImageDto,
  NotePriority,
  NotePublishStatus,
  NoteSummaryDto,
  NoteVersionDto,
  TagCountDto,
  UpdateNoteDto,
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
      headers: authFetchHeaders(init?.headers as Record<string, string> | undefined),
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

// -- Notes -------------------------------------------------------------------

export interface NoteListFilters {
  tags?: string[];
  priorities?: NotePriority[];
  /** OR semantics (N3). */
  categories?: string[];
  /** OR semantics (N3). */
  publishStatuses?: NotePublishStatus[];
  /** Full-text search across title/body/tags (N2 D3). */
  q?: string;
  /** Inclusive creation window (ISO); used by the Memo day view. */
  createdFrom?: string;
  /** Exclusive creation window (ISO); used by the Memo day view. */
  createdTo?: string;
}

export function listNotes(filters: NoteListFilters = {}): Promise<NoteDto[]> {
  const params = new URLSearchParams();
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.priorities?.length) params.set('priorities', filters.priorities.join(','));
  if (filters.categories?.length) params.set('categories', filters.categories.join(','));
  if (filters.publishStatuses?.length) params.set('publishStatuses', filters.publishStatuses.join(','));
  if (filters.q) params.set('q', filters.q);
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);
  const suffix = params.size ? `?${params.toString()}` : '';
  return request(`/api/notes${suffix}`);
}

export function listNoteTags(): Promise<TagCountDto[]> {
  return request('/api/notes/tags');
}

/** Category aggregate for the filter sidebar candidates (N3). */
export function listNoteCategories(): Promise<TagCountDto[]> {
  return request('/api/notes/categories');
}

export function createNote(body: CreateNoteDto): Promise<NoteDto> {
  return request('/api/notes', json('POST', body));
}

export function getNote(id: string): Promise<NoteDto> {
  return request(`/api/notes/${id}`);
}

export function updateNote(id: string, body: UpdateNoteDto): Promise<NoteDto> {
  return request(`/api/notes/${id}`, json('PATCH', body));
}

export function deleteNote(id: string): Promise<void> {
  return request(`/api/notes/${id}`, { method: 'DELETE' });
}

// -- N2: backlinks, versions, images -------------------------------------------

export function listBacklinks(noteId: string): Promise<NoteSummaryDto[]> {
  return request(`/api/notes/${noteId}/backlinks`);
}

export function listVersions(noteId: string): Promise<NoteVersionDto[]> {
  return request(`/api/notes/${noteId}/versions`);
}

export function restoreVersion(noteId: string, seq: number): Promise<NoteDto> {
  return request(`/api/notes/${noteId}/versions/${seq}/restore`, { method: 'POST' });
}

export function listNoteImages(noteId: string): Promise<NoteImageDto[]> {
  return request(`/api/notes/${noteId}/images`);
}

export async function uploadNoteImage(noteId: string, file: File): Promise<NoteImageDto> {
  const form = new FormData();
  form.set('id', crypto.randomUUID());
  form.set('file', file);
  let response: Response;
  try {
    response = await fetch(`/api/notes/${noteId}/images`, {
      method: 'POST',
      headers: authFetchHeaders(),
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  return handleResponse<NoteImageDto>(response);
}

export function deleteNoteImage(noteId: string, imageId: string): Promise<void> {
  return request(`/api/notes/${noteId}/images/${imageId}`, { method: 'DELETE' });
}

export async function noteImageUrl(imageId: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/notes/images/${imageId}/file`, {
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
