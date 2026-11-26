import { describe, expect, it } from 'vitest';
import { noteExcerpt } from '../src/notes.js';

describe('noteExcerpt (N3 home cards)', () => {
  it('strips markdown syntax and collapses whitespace', () => {
    const out = noteExcerpt('# 标题\n\n这是 **正文** 内容，[链接](https://x.dev) 和 `代码`。\n\n- 项目一');
    expect(out).toContain('标题');
    expect(out).toContain('正文 内容，链接 和 代码');
    expect(out).not.toContain('**');
    expect(out).not.toContain('https://x.dev');
    expect(out).not.toContain('#');
  });

  it('drops images entirely and keeps blockquote text', () => {
    expect(noteExcerpt('![截图](note-image://abc-123)\n\n> 引用文字')).toBe('引用文字');
  });

  it('caps long bodies with an ellipsis', () => {
    const out = noteExcerpt('字'.repeat(200));
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith('…')).toBe(true);
  });

  it('handles an empty body', () => {
    expect(noteExcerpt('')).toBe('');
  });
});
