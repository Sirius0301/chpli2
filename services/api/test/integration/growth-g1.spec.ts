import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  api,
  createTestApp,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
  setAuthToken,
} from '../helpers';

/**
 * Integration coverage of the Growth G1 slice: goal CRUD + derived progress,
 * milestone status flow (completedAt), cross-module links (owner-service
 * validation, idempotency, dangling omission) and isolation.
 */

interface GoalDto {
  id: string;
  title: string;
  status: string;
  targetDate: string | null;
  progress: number;
  milestones: { id: string; title: string; status: string; completedAt: string | null }[];
  links: { id: string; module: string; refId: string; title: string }[];
  updatedAt: string;
}

let app: INestApplication;
let tokenA = '';

async function createGoal(body: Record<string, unknown>): Promise<GoalDto> {
  const res = await api(app).post('/api/goals').send({ title: 'Goal', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as GoalDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'growth-g1-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('goals CRUD + derived progress (G1)', () => {
  it('creates a goal and derives progress from milestones (A97/D2)', async () => {
    const goal = await createGoal({
      id: crypto.randomUUID(),
      title: 'Staff engineer',
      description: ' Grow into staff ',
      targetDate: '2027-06-30',
    });
    expect(goal.status).toBe('active');
    expect(goal.targetDate).toBe('2027-06-30');
    expect(goal.progress).toBe(0);

    const m1 = crypto.randomUUID();
    const m2 = crypto.randomUUID();
    await api(app).post(`/api/goals/${goal.id}/milestones`).send({ id: m1, title: 'M1', date: '2026-12-01' });
    const withSecond = await api(app)
      .post(`/api/goals/${goal.id}/milestones`)
      .send({ id: m2, title: 'M2' });
    expect(withSecond.body.progress).toBe(0);

    const done = await api(app)
      .patch(`/api/goals/${goal.id}/milestones/${m1}`)
      .send({ status: 'done' });
    expect(done.body.progress).toBe(50);
    const milestone = done.body.milestones.find((m: { id: string }) => m.id === m1);
    expect(milestone.completedAt).not.toBeNull();

    // Reopening clears completedAt and recomputes.
    const reopened = await api(app)
      .patch(`/api/goals/${goal.id}/milestones/${m1}`)
      .send({ status: 'open' });
    expect(reopened.body.progress).toBe(0);
    expect(reopened.body.milestones.find((m: { id: string }) => m.id === m1).completedAt).toBeNull();

    // Done for good: 100.
    const allDone = await api(app)
      .patch(`/api/goals/${goal.id}/milestones/${m1}`)
      .send({ status: 'done' });
    await api(app).patch(`/api/goals/${goal.id}/milestones/${m2}`).send({ status: 'done' });
    const final = await api(app).get(`/api/goals/${goal.id}`);
    expect(final.body.progress).toBe(100);
    // All milestones done does NOT auto-change the goal status (D3).
    expect(final.body.status).toBe('active');
    void allDone;
  });

  it('E96/E97: invalid status and unreal targetDate are rejected', async () => {
    const badStatus = await api(app)
      .post('/api/goals')
      .send({ id: crypto.randomUUID(), title: 'x', status: 'done' });
    expect(badStatus.status).toBe(400);

    const badDate = await api(app)
      .post('/api/goals')
      .send({ id: crypto.randomUUID(), title: 'x', targetDate: '2026-02-30' });
    expect(badDate.status).toBe(422);
  });

  it('status transitions are manual and PATCH is optimistic-locked', async () => {
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Flow' });
    const achieved = await api(app)
      .patch(`/api/goals/${goal.id}`)
      .send({ status: 'achieved', updatedAt: goal.updatedAt });
    expect(achieved.body.status).toBe('achieved');

    const stale = await api(app)
      .patch(`/api/goals/${goal.id}`)
      .send({ status: 'archived', updatedAt: goal.updatedAt });
    expect(stale.status).toBe(409);
  });

  it('milestone idempotent create and delete (progress recomputes)', async () => {
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Idem' });
    const mid = crypto.randomUUID();
    await api(app).post(`/api/goals/${goal.id}/milestones`).send({ id: mid, title: 'Once' });
    const again = await api(app)
      .post(`/api/goals/${goal.id}/milestones`)
      .send({ id: mid, title: 'Changed' });
    expect(again.body.milestones).toHaveLength(1);
    expect(again.body.milestones[0].title).toBe('Once');

    const removed = await api(app).delete(`/api/goals/${goal.id}/milestones/${mid}`);
    expect(removed.body.milestones).toHaveLength(0);
  });
});

describe('cross-module links (G1 D5)', () => {
  it('validates ownership through the owning module and resolves titles (A99)', async () => {
    const note = await api(app)
      .post('/api/notes')
      .send({ id: crypto.randomUUID(), title: 'Career plan note' });
    const bookmark = await api(app)
      .post('/api/bookmarks')
      .send({ id: crypto.randomUUID(), title: 'Career site', url: 'https://career.example' });
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Linked' });

    const withNote = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'notes', refId: note.body.id });
    expect(withNote.status).toBe(200);
    expect(withNote.body.links).toHaveLength(1);
    expect(withNote.body.links[0].title).toBe('Career plan note');

    const withBoth = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'bookmarks', refId: bookmark.body.id });
    expect(withBoth.body.links.map((l: { module: string }) => l.module).sort()).toEqual([
      'bookmarks',
      'notes',
    ]);

    // E100: re-adding the same link is idempotent.
    const dup = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'notes', refId: note.body.id });
    expect(dup.body.links).toHaveLength(2);
  });

  it('E96/E99: unknown module and invisible targets are rejected', async () => {
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Strict' });
    const badModule = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'memos', refId: 'x' });
    expect(badModule.status).toBe(400);

    const missing = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'notes', refId: 'does-not-exist' });
    expect(missing.status).toBe(404);
  });

  it('dangling links disappear once the target is deleted (D5)', async () => {
    const note = await api(app)
      .post('/api/notes')
      .send({ id: crypto.randomUUID(), title: 'To be deleted' });
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Dangling' });
    await api(app).put(`/api/goals/${goal.id}/links`).send({ module: 'notes', refId: note.body.id });

    await api(app).delete(`/api/notes/${note.body.id}`);
    const after = await api(app).get(`/api/goals/${goal.id}`);
    expect(after.body.links).toHaveLength(0);
    // The link row still exists but is omitted from the DTO (not cascaded into notes).
    const raw = await app.get((await import('../../src/shared/prisma.service')).PrismaService);
    const count = await raw.goalLink.count({ where: { goalId: goal.id } });
    expect(count).toBe(1);
  });

  it('links can be removed explicitly', async () => {
    const note = await api(app).post('/api/notes').send({ id: crypto.randomUUID(), title: 'R' });
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Removable' });
    const linked = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'notes', refId: note.body.id });
    const linkId = linked.body.links[0].id as string;

    const removed = await api(app).delete(`/api/goals/${goal.id}/links/${linkId}`);
    expect(removed.body.links).toHaveLength(0);
  });
});

describe('goals isolation (G1 E101)', () => {
  it('another user cannot see or mutate the goal, its milestones or links', async () => {
    const goal = await createGoal({ id: crypto.randomUUID(), title: 'Private' });
    await api(app).post(`/api/goals/${goal.id}/milestones`).send({ id: crypto.randomUUID(), title: 'M' });

    await registerTestUser(app, 'growth-g1-intruder');
    const list = await api(app).get('/api/goals');
    expect((list.body as GoalDto[]).map((g) => g.id)).not.toContain(goal.id);
    const got = await api(app).get(`/api/goals/${goal.id}`);
    expect(got.status).toBe(404);
    const milestone = await api(app).post(`/api/goals/${goal.id}/milestones`).send({ id: crypto.randomUUID(), title: 'x' });
    expect(milestone.status).toBe(404);
    const link = await api(app)
      .put(`/api/goals/${goal.id}/links`)
      .send({ module: 'notes', refId: 'x' });
    expect(link.status).toBe(404);

    setAuthToken(tokenA);
    const owner = await api(app).get(`/api/goals/${goal.id}`);
    expect(owner.status).toBe(200);
  });
});
