import type {
  ApiErrorBody,
  CreateNoteDto,
  NoteDto,
  NotePriority,
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
}

export function listNotes(filters: NoteListFilters = {}): Promise<NoteDto[]> {
  const params = new URLSearchParams();
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.priorities?.length) params.set('priorities', filters.priorities.join(','));
  const suffix = params.size ? `?${params.toString()}` : '';
  return request(`/api/notes${suffix}`);
}

export function listNoteTags(): Promise<TagCountDto[]> {
  return request('/api/notes/tags');
}

export function createNote(body: CreateNoteDto): Promise<NoteDto> {
  return request('/api/notes', json('POST', body));
}

export function updateNote(id: string, body: UpdateNoteDto): Promise<NoteDto> {
  return request(`/api/notes/${id}`, json('PATCH', body));
}

export function deleteNote(id: string): Promise<void> {
  return request(`/api/notes/${id}`, { method: 'DELETE' });
}
