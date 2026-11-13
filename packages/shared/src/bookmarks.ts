/**
 * Bookmarks module (B1) contract. Mature patterns reused: category
 * constraints from Memo tags, idempotent create / optimistic lock / user
 * isolation from Memo, cover storage semantics from M3/N2.
 */

export const BOOKMARK_TITLE_MAX_LENGTH = 256;

export const BOOKMARK_URL_MAX_LENGTH = 2048;

export const BOOKMARK_DESCRIPTION_MAX_LENGTH = 2000;

/** Category constraints — identical to the Memo tag rules (B1 D1). */
export const BOOKMARK_CATEGORY_MAX_LENGTH = 32;

export const BOOKMARK_CATEGORIES_MAX_COUNT = 10;

/** Inactivity threshold: not clicked within this many days -> gray list (B1 D5). */
export const BOOKMARK_INACTIVE_DAYS = 30;

export const BOOKMARK_SORTS = ['recent', 'clicks', 'title', 'added'] as const;

export type BookmarkSort = (typeof BOOKMARK_SORTS)[number];

/** True for parseable absolute http(s) URLs (B1 D3). */
export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface BookmarkDto {
  id: string;
  title: string;
  url: string;
  /** Hostname captured at save time (B1 D3). */
  domain: string;
  description: string | null;
  categories: string[];
  /** True when cover image metadata exists. */
  hasCover: boolean;
  clickCount: number;
  lastClickedAt: string | null;
  /** Server-computed: COALESCE(lastClickedAt, createdAt) older than 30 days (B1 D5). */
  inactive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkDto {
  /** Client-generated UUID, submitted for idempotent create (E93). */
  id: string;
  title: string;
  url: string;
  description?: string | null;
  categories?: string[];
}

export interface UpdateBookmarkDto {
  title?: string;
  url?: string;
  description?: string | null;
  categories?: string[];
  /** Current updatedAt of the bookmark being edited; mismatch -> 409 (E92). */
  updatedAt?: string;
}
