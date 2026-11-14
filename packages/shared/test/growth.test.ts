import { describe, expect, it } from 'vitest';
import { computeGoalProgress } from '../src/growth.js';

describe('computeGoalProgress (G1 D2)', () => {
  it('returns 0 with no milestones', () => {
    expect(computeGoalProgress([])).toBe(0);
  });

  it('computes the done share and rounds (G1 D7 equal weights)', () => {
    expect(computeGoalProgress([{ status: 'done' }, { status: 'open' }])).toBe(50);
    expect(computeGoalProgress([{ status: 'done' }, { status: 'done' }, { status: 'open' }])).toBe(67);
    expect(computeGoalProgress([{ status: 'done' }])).toBe(100);
    expect(
      computeGoalProgress([
        { status: 'done' },
        { status: 'done' },
        { status: 'open' },
        { status: 'open' },
        { status: 'open' },
      ]),
    ).toBe(40);
  });
});
