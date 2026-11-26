import type { MemoImageMime, MemoPriority } from './memo.js';

/**
 * Notes module (N1) contract. Mature Memo patterns are reused deliberately
 * (M5' D5): same priority enum, same tag constraints, same idempotent-create
 * and isolation semantics.
 */

export type NotePriority = MemoPriority;

export const NOTE_TITLE_MAX_LENGTH = 256;

/** Markdown body size cap (N1 E77). */
export const NOTE_BODY_MAX_BYTES = 100_000;

/** Blog-publish form constraints (N3 cnblog-style editor). */
export const NOTE_CATEGORY_MAX_LENGTH = 32;
export const NOTE_EXCERPT_MAX_LENGTH = 500;
export const NOTE_ACCESS_PASSWORD_MAX_LENGTH = 64;

/** Publish lifecycle of a note: draft / published / scheduled (N3). */
export type NotePublishStatus = 'draft' | 'published' | 'scheduled';
export const NOTE_PUBLISH_STATUSES: readonly NotePublishStatus[] = [
  'draft',
  'published',
  'scheduled',
];

export interface NoteDto {
  id: string;
  title: string;
  /** Markdown source. */
  body: string;
  priority: NotePriority;
  tags: string[];
  /** Free-form blog category (null = uncategorized). */
  category: string | null;
  /** Blog excerpt/summary (null = none). */
  excerpt: string | null;
  allowComments: boolean;
  pinned: boolean;
  /** True when an access password is set (the hash never leaves the API). */
  hasAccessPassword: boolean;
  showOnHome: boolean;
  publishStatus: NotePublishStatus;
  /** Scheduled publish time (status === 'scheduled'). */
  publishAt: string | null;
  /** Actual publish time of the latest publish action. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDto {
  /** Client-generated UUID, submitted for idempotent create (E79). */
  id: string;
  title: string;
  body?: string;
  priority?: NotePriority;
  tags?: string[];
  category?: string | null;
  excerpt?: string | null;
  allowComments?: boolean;
  pinned?: boolean;
  accessPassword?: string | null;
  showOnHome?: boolean;
}

export interface UpdateNoteDto {
  title?: string;
  body?: string;
  priority?: NotePriority;
  tags?: string[];
  category?: string | null;
  excerpt?: string | null;
  allowComments?: boolean;
  pinned?: boolean;
  accessPassword?: string | null;
  showOnHome?: boolean;
  publishStatus?: NotePublishStatus;
  /** Required (and must be in the future) when publishStatus === 'scheduled'. */
  publishAt?: string | null;
  /** Current updatedAt of the note being edited; mismatch -> 409 (E78). */
  updatedAt?: string;
}

/** Versions kept per note before pruning (N2 D4). */
export const NOTE_VERSIONS_KEEP = 50;

/** A historical snapshot of a note (N2). */
export interface NoteVersionDto {
  /** Per-note increasing version number (1 = creation). */
  seq: number;
  title: string;
  body: string;
  priority: NotePriority;
  tags: string[];
  createdAt: string;
}

/** Lightweight note reference for backlinks (N2 D2). */
export interface NoteSummaryDto {
  id: string;
  title: string;
}

/** Metadata for an uploaded note image; the file itself lives in object storage (N2 D6). */
export interface NoteImageDto {
  id: string;
  noteId: string;
  fileName: string;
  mimeType: MemoImageMime;
  sizeBytes: number;
  createdAt: string;
}

/** Card payload for the Host home page (N3 首页展示). */
export interface NoteHomeCardDto {
  id: string;
  title: string;
  excerpt: string;
  category: string | null;
  publishedAt: string;
}

/** Plain-text excerpt: strip common markdown syntax, collapse, cap length. */
export function noteExcerpt(markdown: string, max = 100): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>|-]+/g, ' ')
    .replace(/\$\$?[\s\S]*?\$\$?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
