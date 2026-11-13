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

export interface NoteDto {
  id: string;
  title: string;
  /** Markdown source. */
  body: string;
  priority: NotePriority;
  tags: string[];
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
}

export interface UpdateNoteDto {
  title?: string;
  body?: string;
  priority?: NotePriority;
  tags?: string[];
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
