import { describe, expect, it } from 'vitest';
import { preprocessWikiLinks, isWikiHref, noteIdFromWikiHref, WIKI_HREF_PREFIX } from '../wiki';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const UNKNOWN = '99999999-8888-4777-8666-555555555555';

const NOTES = [
  { id: A, title: 'Alpha [draft]' },
  { id: B, title: 'Beta' },
];

describe('preprocessWikiLinks (N2 D1)', () => {
  it('rewrites [[id]] tokens to markdown links with resolved titles', () => {
    const { markdown, brokenIds } = preprocessWikiLinks(`see [[${A}]] and [[${B}]]`, NOTES);
    expect(markdown).toContain(`[Alpha \\[draft\\]](${WIKI_HREF_PREFIX}${A})`);
    expect(markdown).toContain(`[Beta](${WIKI_HREF_PREFIX}${B})`);
    expect(brokenIds).toEqual([]);
  });

  it('marks unresolvable tokens as broken (E84)', () => {
    const { markdown, brokenIds } = preprocessWikiLinks(`see [[${UNKNOWN}]]`, NOTES);
    expect(markdown).toContain(`[broken](${WIKI_HREF_PREFIX}${UNKNOWN})`);
    expect(brokenIds).toEqual([UNKNOWN]);
  });

  it('ignores non-uuid [[...]] tokens', () => {
    const { markdown, brokenIds } = preprocessWikiLinks('plain [[not-a-link]] text', NOTES);
    expect(markdown).toBe('plain [[not-a-link]] text');
    expect(brokenIds).toEqual([]);
  });
});

describe('wiki href helpers', () => {
  it('round-trips the #n/ prefix', () => {
    expect(isWikiHref(`${WIKI_HREF_PREFIX}${A}`)).toBe(true);
    expect(isWikiHref('https://example.com')).toBe(false);
    expect(noteIdFromWikiHref(`${WIKI_HREF_PREFIX}${A}`)).toBe(A);
  });
});
