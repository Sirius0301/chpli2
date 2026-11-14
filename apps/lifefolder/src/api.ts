import type { ApiErrorBody, LifeCategoryDto, LifeDocumentDto, LifeTemplateDto } from '@chpli2/shared';
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

// -- Life Folder -----------------------------------------------------------------

export function listCategories(): Promise<LifeCategoryDto[]> {
  return request('/api/life-folder/categories');
}

export function createCategory(body: { name: string; parentId?: string | null }): Promise<LifeCategoryDto[]> {
  return request('/api/life-folder/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteCategory(id: string): Promise<void> {
  return request(`/api/life-folder/categories/${id}`, { method: 'DELETE' });
}

export function listTemplates(): Promise<LifeTemplateDto[]> {
  return request('/api/life-folder/templates');
}

export function listDocuments(categoryId?: string): Promise<LifeDocumentDto[]> {
  const suffix = categoryId ? `?category_id=${categoryId}` : '';
  return request(`/api/life-folder/documents${suffix}`);
}

export async function uploadDocument(fields: {
  id: string;
  title: string;
  categoryId: string;
  notes?: string;
  sensitive: boolean;
  templateId?: string | null;
  file: File;
}): Promise<LifeDocumentDto> {
  const form = new FormData();
  form.set('id', fields.id);
  form.set('title', fields.title);
  form.set('categoryId', fields.categoryId);
  if (fields.notes) form.set('notes', fields.notes);
  form.set('sensitive', String(fields.sensitive));
  if (fields.templateId) form.set('templateId', fields.templateId);
  form.set('file', fields.file);
  let response: Response;
  try {
    response = await fetch('/api/life-folder/documents', {
      method: 'POST',
      headers: authFetchHeaders(),
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  return handleResponse<LifeDocumentDto>(response);
}

export function updateDocument(
  id: string,
  body: { title?: string; notes?: string | null; sensitive?: boolean; categoryId?: string; updatedAt?: string },
): Promise<LifeDocumentDto> {
  return request(`/api/life-folder/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteDocument(id: string): Promise<void> {
  return request(`/api/life-folder/documents/${id}`, { method: 'DELETE' });
}

export async function documentFileUrl(id: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/life-folder/documents/${id}/file`, {
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
