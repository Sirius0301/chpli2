import type { MemoImageMime } from './memo.js';

/**
 * Life Folder (L1) contract: category taxonomy, document records (metadata +
 * object storage), built-in templates and recommendations.
 */

export const CATEGORY_NAME_MAX_LENGTH = 64;

export const DOCUMENT_TITLE_MAX_LENGTH = 256;

export const DOCUMENT_NOTES_MAX_LENGTH = 2000;

/** Allowed upload types: PDF plus the four image types (magic-byte sniffed). */
export const LIFE_DOC_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type LifeDocMime = (typeof LIFE_DOC_MIME_TYPES)[number] | MemoImageMime;

/** Per-file upload cap (life documents are mostly scanned PDFs). */
export const LIFE_DOC_MAX_BYTES = 10 * 1024 * 1024;

export interface LifeCategoryDto {
  id: string;
  /** null = built-in (system-owned, read-only, not deletable). */
  userId: string | null;
  name: string;
  parentId: string | null;
  sortOrder: number;
  builtIn: boolean;
  children: LifeCategoryDto[];
}

export interface LifeTemplateDto {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  recommended: boolean;
}

export interface LifeDocumentDto {
  id: string;
  categoryId: string;
  title: string;
  notes: string | null;
  /** Sensitive files are private by default (L1 D5). */
  sensitive: boolean;
  templateId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLifeCategoryDto {
  name: string;
  parentId?: string | null;
}

export interface CreateLifeDocumentDto {
  /** Client-generated UUID, submitted for idempotent create. */
  id: string;
  title: string;
  categoryId: string;
  notes?: string | null;
  sensitive?: boolean;
  templateId?: string | null;
}

export interface UpdateLifeDocumentDto {
  title?: string;
  notes?: string | null;
  sensitive?: boolean;
  categoryId?: string;
  /** Current updatedAt of the document being edited; mismatch -> 409. */
  updatedAt?: string;
}
