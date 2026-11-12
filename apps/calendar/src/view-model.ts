import type { MemoDto, MemoPriority, MemoRepeatRule } from '@chpli2/shared';
import { expandMemoToRange } from '@chpli2/shared';

/**
 * A single dated instance of a memo after repeat expansion. Non-repeating
 * memos yield exactly one instance; repeating memos yield one per occurrence
 * in the view window (M1 D2: expansion happens on the frontend).
 */
export interface DisplayMemoInstance {
  /** Stable per-instance key: `${memoId}:${dateKey}`. */
  key: string;
  memoId: string;
  /** YYYY-MM-DD occurrence date. */
  date: string;
  title: string;
  priority: MemoPriority;
  repeat: MemoRepeatRule;
  completed: boolean;
  tags: string[];
  /** The raw memo (carries completions + optimistic-lock state). */
  source: MemoDto;
}

/** Expands raw memos into dated display instances for a closed key range. */
export function buildInstances(
  memos: MemoDto[],
  fromKey: string,
  toKey: string,
): DisplayMemoInstance[] {
  const out: DisplayMemoInstance[] = [];
  for (const memo of memos) {
    for (const date of expandMemoToRange(memo, fromKey, toKey)) {
      out.push({
        key: `${memo.id}:${date}`,
        memoId: memo.id,
        date,
        title: memo.title,
        priority: memo.priority,
        repeat: memo.repeat,
        completed:
          memo.repeat === 'none'
            ? memo.completedAt !== null
            : memo.completions.includes(date),
        tags: memo.tags,
        source: memo,
      });
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
}

/** Groups instances by their occurrence day key. */
export function instancesByDay(
  instances: DisplayMemoInstance[],
): Map<string, DisplayMemoInstance[]> {
  const map = new Map<string, DisplayMemoInstance[]>();
  for (const instance of instances) {
    const bucket = map.get(instance.date);
    if (bucket) bucket.push(instance);
    else map.set(instance.date, [instance]);
  }
  return map;
}
