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
 * Integration coverage of the Growth G2 slice: skills (ownership by goal,
 * unique names, levels), reviews (dates, links, schedule-next-memo
 * idempotency through MemoService) and isolation. G1 goal links run against
 * the migrated unified growth_links table (regression).
 */

interface SkillDto {
  id: string;
  name: string;
  level: number;
  goalId: string | null;
  goalTitle: string | null;
  links: { module: string; refId: string; title: string }[];
}

interface ReviewDto {
  id: string;
  title: string;
  reviewedAt: string;
  goalId: string | null;
  links: { module: string; refId: string; title: string }[];
  nextMemoDate: string | null;
  nextMemoId: string | null;
}

let app: INestApplication;
let tokenA = '';

function pad(v: number) {
  return String(v).padStart(2, '0');
}

function offsetKey(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'growth-g2-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('skills (G2)', () => {
  it('creates a skill with level and owning goal; duplicate name is rejected (A102/E102)', async () => {
    const goal = await api(app)
      .post('/api/goals')
      .send({ id: crypto.randomUUID(), title: 'Backend mastery' });
    const skill = await api(app)
      .post('/api/skills')
      .send({ id: crypto.randomUUID(), name: ' Postgres ', level: 3, goalId: goal.body.id });
    expect(skill.status, JSON.stringify(skill.body)).toBe(201);
    expect(skill.body.name).toBe('Postgres');
    expect(skill.body.level).toBe(3);
    expect(skill.body.goalTitle).toBe('Backend mastery');

    const dup = await api(app)
      .post('/api/skills')
      .send({ id: crypto.randomUUID(), name: 'Postgres', level: 1 });
    expect(dup.status).toBe(409);
    expect(dup.body.errorCode).toBe('SKILL_EXISTS');
  });

  it('E102/E103: bad level and unknown goal are rejected', async () => {
    const badLevel = await api(app)
      .post('/api/skills')
      .send({ id: crypto.randomUUID(), name: 'x-level', level: 6 });
    expect(badLevel.status).toBe(422);

    const badGoal = await api(app)
      .post('/api/skills')
      .send({ id: crypto.randomUUID(), name: 'x-goal', goalId: crypto.randomUUID() });
    expect(badGoal.status).toBe(404);
  });

  it('deleting the owning goal keeps the skill with goalId nulled (D1)', async () => {
    const goal = await api(app).post('/api/goals').send({ id: crypto.randomUUID(), title: 'Temp' });
    const skill = await api(app)
      .post('/api/skills')
      .send({ id: crypto.randomUUID(), name: 'SkillToFree', goalId: goal.body.id });
    await api(app).delete(`/api/goals/${goal.body.id}`);
    const after = await api(app).get(`/api/skills/${skill.body.id}`);
    expect(after.status).toBe(200);
    expect(after.body.goalId).toBeNull();
    expect(after.body.goalTitle).toBeNull();
  });

  it('links evidence (note) and resource (bookmark) with resolved titles (A103)', async () => {
    const note = await api(app).post('/api/notes').send({ id: crypto.randomUUID(), title: 'PG deep dive' });
    const bookmark = await api(app)
      .post('/api/bookmarks')
      .send({ id: crypto.randomUUID(), title: 'PG docs', url: 'https://pg.example' });
    const skill = await api(app)
      .post('/api/skills')
      .send({ id: crypto.randomUUID(), name: 'SkillLinked' });

    const withNote = await api(app)
      .put(`/api/skills/${skill.body.id}/links`)
      .send({ module: 'notes', refId: note.body.id });
    expect(withNote.body.links.map((l: { title: string }) => l.title)).toEqual(['PG deep dive']);

    const withBoth = await api(app)
      .put(`/api/skills/${skill.body.id}/links`)
      .send({ module: 'bookmarks', refId: bookmark.body.id });
    expect(withBoth.body.links).toHaveLength(2);

    // Idempotent re-add.
    const dup = await api(app)
      .put(`/api/skills/${skill.body.id}/links`)
      .send({ module: 'notes', refId: note.body.id });
    expect(dup.body.links).toHaveLength(2);

    // Dangling: deleting the note drops the link from the DTO.
    await api(app).delete(`/api/notes/${note.body.id}`);
    const after = await api(app).get(`/api/skills/${skill.body.id}`);
    expect(after.body.links).toHaveLength(1);
    expect(after.body.links[0].module).toBe('bookmarks');
  });
});

describe('reviews (G2)', () => {
  it('creates a review defaulting to today and links an existing memo (A104)', async () => {
    const memo = await api(app)
      .post('/api/memos')
      .send({ id: crypto.randomUUID(), title: 'Retro memo', date: offsetKey(0) });
    const today = offsetKey(0);
    const review = await api(app)
      .post('/api/reviews')
      .send({ id: crypto.randomUUID(), title: 'Monthly retro', content: 'went well' });
    expect(review.status, JSON.stringify(review.body)).toBe(201);
    expect(review.body.reviewedAt).toBe(today);

    const linked = await api(app)
      .put(`/api/reviews/${review.body.id}/links`)
      .send({ module: 'memos', refId: memo.body.id });
    expect(linked.body.links.map((l: { title: string }) => l.title)).toEqual(['Retro memo']);
  });

  it('E104: schedule date in the past is rejected; bad reviewedAt is 422', async () => {
    const review = await api(app).post('/api/reviews').send({ id: crypto.randomUUID(), title: 'r' });
    const past = await api(app)
      .post(`/api/reviews/${review.body.id}/schedule-next-memo`)
      .send({ date: offsetKey(-1) });
    expect(past.status).toBe(422);

    const bad = await api(app)
      .post('/api/reviews')
      .send({ id: crypto.randomUUID(), title: 'x', reviewedAt: '2026-02-30' });
    expect(bad.status).toBe(422);
  });

  it('schedule-next-memo creates one memo and is idempotent on retry (A105/E108)', async () => {
    const review = await api(app)
      .post('/api/reviews')
      .send({ id: crypto.randomUUID(), title: 'Quarterly review' });
    const date = offsetKey(7);

    const first = await api(app)
      .post(`/api/reviews/${review.body.id}/schedule-next-memo`)
      .send({ date });
    expect(first.status).toBe(201);
    expect(first.body.nextMemoDate).toBe(date);
    expect(first.body.nextMemoId).not.toBeNull();

    const second = await api(app)
      .post(`/api/reviews/${review.body.id}/schedule-next-memo`)
      .send({ date });
    expect(second.body.nextMemoId).toBe(first.body.nextMemoId);

    // Exactly one memo exists for this review.
    const memos = (await api(app).get(`/api/memos?from=${date}&to=${offsetKey(8)}`)).body as {
      title: string;
    }[];
    const created = memos.filter((m) => m.title === 'Quarterly review（回顾）');
    expect(created).toHaveLength(1);

    // Deleting the memo heals: scheduling again recreates it with a fresh id.
    await api(app).delete(`/api/memos/${first.body.nextMemoId}`);
    const healed = await api(app)
      .post(`/api/reviews/${review.body.id}/schedule-next-memo`)
      .send({ date });
    expect(healed.body.nextMemoId).not.toBeNull();
    expect(healed.body.nextMemoId).not.toBe(first.body.nextMemoId);
    const memosAfter = (await api(app).get(`/api/memos?from=${date}&to=${offsetKey(8)}`)).body as {
      title: string;
    }[];
    expect(memosAfter.filter((m) => m.title === 'Quarterly review（回顾）')).toHaveLength(1);
  });
});

describe('growth isolation (G2 E107)', () => {
  it('another user cannot see or mutate skills/reviews/links', async () => {
    const skill = await api(app).post('/api/skills').send({ id: crypto.randomUUID(), name: 'Mine' });
    const review = await api(app).post('/api/reviews').send({ id: crypto.randomUUID(), title: 'Mine' });

    await registerTestUser(app, 'growth-g2-intruder');
    expect((await api(app).get('/api/skills')).body).toEqual([]);
    expect((await api(app).get('/api/reviews')).body).toEqual([]);
    expect((await api(app).get(`/api/skills/${skill.body.id}`)).status).toBe(404);
    expect((await api(app).patch(`/api/skills/${skill.body.id}`).send({ level: 5 })).status).toBe(404);
    expect(
      (await api(app).put(`/api/skills/${skill.body.id}/links`).send({ module: 'notes', refId: 'x' })).status,
    ).toBe(404);
    expect(
      (await api(app).post(`/api/reviews/${review.body.id}/schedule-next-memo`).send({ date: offsetKey(1) })).status,
    ).toBe(404);

    setAuthToken(tokenA);
  });
});
