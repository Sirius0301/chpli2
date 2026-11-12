import type { MemoPriority } from './memo.js';

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
