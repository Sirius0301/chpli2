/**
 * Editor pure helpers (N3 cnblog-style editor): markdown insertion, anchor
 * slugs, TOC generation, list continuation and the localStorage draft
 * fallback. Kept framework-free so they are directly unit-testable.
 */

/** Applies a wrap/insert transform around the textarea's current selection. */
export function applyTextareaTransform(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  transform: (selected: string, cursor: 'start' | 'middle' | 'end') => {
    text: string;
    cursorOffset: number;
    selectStart?: number;
    selectEnd?: number;
  },
): { next: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const result = transform(selected, selectionStart === selectionEnd ? 'end' : 'middle');
  const next = value.slice(0, selectionStart) + result.text + value.slice(selectionEnd);
  if (result.selectStart !== undefined && result.selectEnd !== undefined) {
    const base = selectionStart;
    return {
      next,
      selectionStart: base + result.selectStart,
      selectionEnd: base + result.selectEnd,
    };
  }
  const cursor = selectionStart + result.cursorOffset;
  return { next, selectionStart: cursor, selectionEnd: cursor };
}

/** Bold: wraps the selection in **…** (or inserts **** with cursor inside). */
export const boldTransform = (selected: string) => ({
  text: `**${selected}**`,
  cursorOffset: selected ? selected.length + 4 : 2,
});

/** Inline code: wraps in `…`. */
export const inlineCodeTransform = (selected: string) => ({
  text: `\`${selected}\``,
  cursorOffset: selected ? selected.length + 2 : 1,
});

/** fenced code block around (or below) the selection. */
export const codeBlockTransform = (selected: string) => ({
  text: `\`\`\`\n${selected}\n\`\`\`\n`,
  cursorOffset: selected ? selected.length + 5 : 4,
});

/** Blockquote: prefixes every non-empty selected line with '> '. */
export const quoteTransform = (selected: string) => ({
  text: selected
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : line))
    .join('\n'),
  cursorOffset: selected.length + selected.split('\n').filter((l) => l.trim()).length * 2,
});

/** Unordered list: prefixes every selected line with '- '. */
export const unorderedListTransform = (selected: string) => ({
  text: selected
    .split('\n')
    .map((line) => (line.trim() ? `- ${line}` : line))
    .join('\n'),
  cursorOffset: selected.length + selected.split('\n').filter((l) => l.trim()).length * 2,
});

/** Ordered list: numbers every selected line. */
export const orderedListTransform = (selected: string) => ({
  text: selected
    .split('\n')
    .map((line, i) => (line.trim() ? `${i + 1}. ${line}` : line))
    .join('\n'),
  cursorOffset: selected.length + selected.split('\n').filter((l) => l.trim()).length * 3,
});

/** Task list: prefixes every selected line with '- [ ] '. */
export const taskListTransform = (selected: string) => ({
  text: selected
    .split('\n')
    .map((line) => (line.trim() ? `- [ ] ${line}` : line))
    .join('\n'),
  cursorOffset: selected.length + selected.split('\n').filter((l) => l.trim()).length * 6,
});

/** 2x2 table template; the header row is pre-selected for typing. */
export const tableTransform = () => ({
  text: '| 列1 | 列2 |\n| --- | --- |\n|  |  |\n',
  cursorOffset: 2,
  selectStart: 2,
  selectEnd: 4,
});

/** Link: [text](url); selection becomes the link text, url pre-selected. */
export const linkTransform = (selected: string) => {
  const start = (selected ? selected.length : 4) + 3;
  return {
    text: `[${selected || '链接文字'}](https://)`,
    cursorOffset: selected ? selected.length + 3 : 5,
    selectStart: start,
    selectEnd: start + 8,
  };
};

/** TeX: wraps the selection in $$…$$ (display math). */
export const texTransform = (selected: string) => ({
  text: `$$\n${selected}\n$$`,
  cursorOffset: selected ? selected.length + 5 : 3,
});

/** GitHub-style heading anchor: lowercase, spaces -> '-', drop punctuation. */
export function headingAnchor(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

/** Extracts markdown headings in document order. */
export function extractHeadings(markdown: string): { depth: number; text: string }[] {
  const out: { depth: number; text: string }[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) out.push({ depth: match[1]!.length, text: match[2]! });
  }
  return out;
}

/** Builds a nested-agnostic TOC markdown list (anchors match headingAnchor). */
export function buildTocMarkdown(markdown: string): string {
  const headings = extractHeadings(markdown);
  if (!headings.length) return '';
  return headings.map((h) => `${'  '.repeat(h.depth - 1)}- [${h.text}](#${headingAnchor(h.text)})`).join('\n') + '\n';
}

/**
 * Enter-key continuation for list items (自动补全). Returns the text to
 * insert at the cursor when it sits at the end of a non-empty list-item
 * line, starting with '\n' (plain newline + same marker). Returns null for
 * empty items (the caller strips the marker) and non-list lines.
 */
export function listContinuation(line: string, column: number): string | null {
  const before = line.slice(0, column);
  const match = /^(\s*)([-*+]|\d+\.)\s+\S/.exec(before);
  if (!match) return null;
  const [, indent, marker] = match;
  const next = /^\d+\.$/.test(marker!) ? `${parseInt(marker!, 10) + 1}.` : marker!;
  return `\n${indent}${next} `;
}

/** Matches a list-item line that contains only the marker and one space. */
export const EMPTY_LIST_ITEM_RE = /^(\s*)([-*+]|\d+\.)\s$/;

// -- localStorage draft fallback (自动备份兜底) -----------------------------

const draftKey = (noteId: string) => `chpli2-note-draft:${noteId}`;

export function readLocalDraft<T>(noteId: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(noteId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(noteId: string, draft: unknown): void {
  try {
    const snapshot = typeof draft === 'object' && draft !== null ? draft : {};
    localStorage.setItem(draftKey(noteId), JSON.stringify({ ...snapshot, __savedAt: Date.now() }));
  } catch {
    /* storage full/unavailable: the server autosave still covers us */
  }
}

export function clearLocalDraft(noteId: string): void {
  try {
    localStorage.removeItem(draftKey(noteId));
  } catch {
    /* ignore */
  }
}

/** Image syntax embedded in the markdown source (resolved at render time). */
export const NOTE_IMAGE_PREFIX = 'note-image://';
export const isNoteImageSrc = (src: string) => src.startsWith(NOTE_IMAGE_PREFIX);
export const noteImageIdFromSrc = (src: string) => src.slice(NOTE_IMAGE_PREFIX.length);
export const noteImageSrc = (id: string) => `${NOTE_IMAGE_PREFIX}${id}`;
