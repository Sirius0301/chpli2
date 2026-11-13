import type { NoteSummaryDto } from '@chpli2/shared';

/**
 * Wiki-link preprocessing (N2 D1): `[[<uuid>]]` tokens are rewritten to
 * markdown links `[title](#n/<uuid>)` before ReactMarkdown renders them;
 * unresolved tokens become broken-link placeholders. Resolution happens at
 * render time against the user's own notes only (id -> title map), so link
 * storage is always the stable ID.
 */

export const WIKI_LINK_RE = /\[\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]\]/g;

/** `#n/<id>` href prefix marking an in-app wiki link. */
export const WIKI_HREF_PREFIX = '#n/';

export function isWikiHref(href: string | undefined): boolean {
  return !!href && href.startsWith(WIKI_HREF_PREFIX);
}

export function noteIdFromWikiHref(href: string): string {
  return href.slice(WIKI_HREF_PREFIX.length);
}

export interface WikiPreprocessResult {
  markdown: string;
  /** Tokens that did not resolve to a visible note. */
  brokenIds: string[];
}

export function preprocessWikiLinks(body: string, notes: NoteSummaryDto[]): WikiPreprocessResult {
  const titles = new Map(notes.map((n) => [n.id, n.title]));
  const brokenIds: string[] = [];
  const markdown = body.replace(WIKI_LINK_RE, (_match, id: string) => {
    const title = titles.get(id);
    if (!title) {
      brokenIds.push(id);
      return `[broken](${WIKI_HREF_PREFIX}${id})`;
    }
    return `[${title.replace(/([\[\]])/g, '\\$1')}](${WIKI_HREF_PREFIX}${id})`;
  });
  return { markdown, brokenIds };
}
