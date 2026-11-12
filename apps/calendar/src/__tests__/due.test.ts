import { describe, expect, it } from 'vitest';
import { daysUntil, dueFromKey, dueInstances, dueToKey, dueTodayKeys } from '../due';
import type { DisplayMemoInstance } from '../view-model';

const TODAY = '2026-11-12';

function inst(partial: Partial<DisplayMemoInstance> & Pick<DisplayMemoInstance, 'memoId' | 'date' | 'title'>): DisplayMemoInstance {
  return {
    key: `${partial.memoId}:${partial.date}`,
    priority: 'none',
    repeat: 'none',
    completed: false,
    tags: [],
    source: {} as DisplayMemoInstance['source'],
    ...partial,
  };
}

describe('due window (M4 D1)', () => {
  it('spans one week back and three days forward, inclusive of today', () => {
    expect(dueFromKey(TODAY)).toBe('2026-11-05');
    expect(dueToKey(TODAY)).toBe('2026-11-15');
  });

  it('keeps uncompleted instances in the window, oldest first', () => {
    const out = dueInstances(
      [
        inst({ memoId: 'a', date: '2026-11-14', title: 'upcoming' }),
        inst({ memoId: 'b', date: '2026-11-06', title: 'overdue' }),
        inst({ memoId: 'c', date: '2026-11-12', title: 'today' }),
        inst({ memoId: 'd', date: '2026-11-12', title: 'done', completed: true }),
        inst({ memoId: 'e', date: '2026-11-20', title: 'too far' }),
        inst({ memoId: 'f', date: '2026-10-01', title: 'too old' }),
      ],
      TODAY,
    );
    expect(out.map((i) => i.title)).toEqual(['overdue', 'today', 'upcoming']);
  });
});

describe('dueTodayKeys (M4 D7)', () => {
  it('flags only today, only uncompleted', () => {
    const keys = dueTodayKeys(
      [
        inst({ memoId: 'a', date: TODAY, title: 'due today' }),
        inst({ memoId: 'b', date: TODAY, title: 'done today', completed: true }),
        inst({ memoId: 'c', date: '2026-11-13', title: 'tomorrow' }),
      ],
      TODAY,
    );
    expect([...keys]).toEqual([TODAY]);
  });
});

describe('daysUntil', () => {
  it('computes signed day differences', () => {
    expect(daysUntil('2026-11-12', TODAY)).toBe(0);
    expect(daysUntil('2026-11-15', TODAY)).toBe(3);
    expect(daysUntil('2026-11-09', TODAY)).toBe(-3);
  });
});
