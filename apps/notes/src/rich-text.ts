/**
 * Rich-text mode helpers (N3): the note body stays Markdown — the rich
 * editor surface converts HTML -> Markdown on every input (Turndown) and
 * Markdown -> HTML when entering the mode (unified/remark pipeline, the
 * same dialect as the preview).
 */
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { isNoteImageSrc } from './editor-utils';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});
turndown.use(gfm);

// note-image://<id> survives the round trip: the rich editor shows a blob
// URL but keeps the stable reference in the src attribute prefix.
turndown.addRule('noteImage', {
  filter: 'img',
  replacement(_content, node) {
    const el = node as unknown as HTMLImageElement;
    const src = el.getAttribute('src') ?? '';
    if (!isNoteImageSrc(src)) {
      return src ? `![${el.getAttribute('alt') ?? ''}](${src})` : '';
    }
    return `![${el.getAttribute('alt') ?? ''}](${src})`;
  },
});

/** Rich-editor HTML -> Markdown (single source of truth stays Markdown). */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

const markdownToHtml = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

/** Markdown -> HTML for seeding the contentEditable surface. */
export function markdownToEditingHtml(markdown: string): string {
  return String(markdownToHtml.processSync(markdown));
}

/** Markdown constructs the rich editor would silently degrade. */
export function richModeLossWarnings(markdown: string): string[] {
  const warnings: string[] = [];
  if (/\$\$[\s\S]*\$\$/.test(markdown)) warnings.push('tex');
  if (/\[\[[0-9a-f-]{36}\]\]/.test(markdown)) warnings.push('wiki');
  if (/^```/m.test(markdown)) warnings.push('codeblock');
  return warnings;
}

/** Ids of note-image refs embedded in the markdown (for blob resolution). */
export function noteImageIdsIn(markdown: string): string[] {
  const ids: string[] = [];
  const re = /!\[[^\]]*\]\(note-image:\/\/([0-9a-f-]{36})\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) ids.push(match[1]!);
  return [...new Set(ids)];
}
