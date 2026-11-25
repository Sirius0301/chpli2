import { describe, expect, it } from 'vitest';
import {
  applyTextareaTransform,
  boldTransform,
  buildTocMarkdown,
  EMPTY_LIST_ITEM_RE,
  headingAnchor,
  linkTransform,
  listContinuation,
  noteImageIdFromSrc,
  noteImageSrc,
  orderedListTransform,
  quoteTransform,
  tableTransform,
  taskListTransform,
} from '../editor-utils';

describe('applyTextareaTransform', () => {
  it('wraps the selection and places the cursor after it', () => {
    const r = applyTextareaTransform('hello world', 0, 5, boldTransform);
    expect(r.next).toBe('**hello** world');
    expect(r.selectionStart).toBe(9);
    expect(r.selectionEnd).toBe(9);
  });

  it('places the cursor inside the markers for an empty selection', () => {
    const r = applyTextareaTransform('ab', 1, 1, boldTransform);
    expect(r.next).toBe('a****b');
    expect(r.selectionStart).toBe(3);
  });

  it('pre-selects the table header cell', () => {
    const r = applyTextareaTransform('', 0, 0, tableTransform);
    expect(r.next).toContain('| 列1 | 列2 |');
    expect(r.next.slice(r.selectionStart, r.selectionEnd)).toBe('列1');
  });

  it('pre-selects the link URL', () => {
    const r = applyTextareaTransform('', 0, 0, linkTransform);
    expect(r.next).toBe('[链接文字](https://)');
    expect(r.next.slice(r.selectionStart, r.selectionEnd)).toBe('https://');
  });
});

describe('block transforms', () => {
  it('prefixes every non-empty line for quote / lists / tasks', () => {
    expect(applyTextareaTransform('a\n\nb', 0, 5, quoteTransform).next).toBe('> a\n\n> b');
    expect(applyTextareaTransform('x\ny', 0, 3, orderedListTransform).next).toBe('1. x\n2. y');
    expect(applyTextareaTransform('买牛奶', 0, 3, taskListTransform).next).toBe('- [ ] 买牛奶');
  });
});

describe('listContinuation (自动补全)', () => {
  it('continues unordered markers with the same indent', () => {
    expect(listContinuation('  - 买牛奶', 8)).toBe('\n  - ');
  });

  it('increments ordered markers', () => {
    expect(listContinuation('1. 第一', 5)).toBe('\n2. ');
  });

  it('returns null outside list lines', () => {
    expect(listContinuation('普通文本', 4)).toBeNull();
    expect(listContinuation('- ', 2)).toBeNull();
  });

  it('EMPTY_LIST_ITEM_RE matches a bare marker line', () => {
    expect(EMPTY_LIST_ITEM_RE.test('- ')).toBe(true);
    expect(EMPTY_LIST_ITEM_RE.test('  3. ')).toBe(true);
    expect(EMPTY_LIST_ITEM_RE.test('- x')).toBe(false);
  });
});

describe('buildTocMarkdown / headingAnchor', () => {
  it('slugs headings GitHub-style and builds a nested list', () => {
    expect(headingAnchor('Hello World!')).toBe('hello-world');
    const toc = buildTocMarkdown('# 标题一\n\n正文\n\n## 小节 A\n\n# 标题二');
    expect(toc).toBe('- [标题一](#标题一)\n  - [小节 A](#小节-a)\n- [标题二](#标题二)\n');
  });

  it('returns an empty string without headings', () => {
    expect(buildTocMarkdown('没有标题')).toBe('');
  });
});

describe('note-image refs', () => {
  it('round-trips ids through the note-image:// scheme', () => {
    const src = noteImageSrc('abc-123');
    expect(src).toBe('note-image://abc-123');
    expect(noteImageIdFromSrc(src)).toBe('abc-123');
  });
});
