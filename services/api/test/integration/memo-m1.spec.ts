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
 * Integration coverage of the M1 Memo slice: CRUD (E43–E47), repeat-window
 * listing, completion mechanics (E50/E51, idempotent per-instance toggles),
 * optimistic locking (E49) and cross-user isolation (E48, M0 D5).
 */

interface MemoDto {
  id: string;
  title: string;
  date: string;
  priority: string;
  note: string | null;
  repeat: string;
  repeatEnd: string | null;
  completedAt: string | null;
  completions: string[];
  createdAt: string;
  updatedAt: string;
}

let app: INestApplication;
let tokenA = '';

async function createMemo(body: Record<string, unknown>): Promise<MemoDto> {
  const res = await api(app)
    .post('/api/memos')
    .send({ title: 'Test memo', priority: 'none', repeat: 'none', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as MemoDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'memo-m1-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('memo CRUD', () => {
  it('creates a memo with defaults and reads it back', async () => {
    const memo = await createMemo({ id: crypto.randomUUID(), title: 'Buy milk', date: '2026-11-12' });
    expect(memo.priority).toBe('none');
    expect(memo.repeat).toBe('none');
    expect(memo.repeatEnd).toBeNull();
    expect(memo.completedAt).toBeNull();
    expect(memo.completions).toEqual([]);

    const got = await api(app).get(`/api/memos/${memo.id}`);
    expect(got.status).toBe(200);
    expect(got.body.title).toBe('Buy milk');
  });

  it('E47: a repeated create with the same id returns the original record', async () => {
    const id = crypto.randomUUID();
    const first = await createMemo({ id, title: 'Idempotent', date: '2026-11-12' });
    const res = await api(app)
      .post('/api/memos')
      .send({ id, title: 'Changed title should not apply', date: '2026-11-13' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(first.id);
    expect(res.body.title).toBe('Idempotent');
    expect(res.body.date).toBe('2026-11-12');
  });

  it('E43: empty title is rejected (422)', async () => {
    const res = await api(app)
      .post('/api/memos')
      .send({ id: crypto.randomUUID(), title: '   ', date: '2026-11-12' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('E44/E45: bad dates and repeatEnd before date are rejected (422)', async () => {
    const badDate = await api(app)
      .post('/api/memos')
      .send({ id: crypto.randomUUID(), title: 'x', date: '2026-02-30' });
    expect(badDate.status).toBe(422);
    expect(badDate.body.errorCode).toBe('VALIDATION_ERROR');

    const badEnd = await api(app)
      .post('/api/memos')
      .send({
        id: crypto.randomUUID(),
        title: 'x',
        date: '2026-11-12',
        repeat: 'weekly',
        repeatEnd: '2026-11-01',
      });
    expect(badEnd.status).toBe(422);
    expect(badEnd.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('E46: invalid priority / repeat enums are rejected (400, DTO layer)', async () => {
    const badPriority = await api(app)
      .post('/api/memos')
      .send({ id: crypto.randomUUID(), title: 'x', date: '2026-11-12', priority: 'urgent' });
    expect(badPriority.status).toBe(400);
    expect(badPriority.body.errorCode).toBe('VALIDATION_ERROR');

    const badRepeat = await api(app)
      .post('/api/memos')
      .send({ id: crypto.randomUUID(), title: 'x', date: '2026-11-12', repeat: 'rrule' });
    expect(badRepeat.status).toBe(400);
    expect(badRepeat.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('repeatEnd is stored and cleared when switching back to none', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Weekly until',
      date: '2026-11-05',
      repeat: 'weekly',
      repeatEnd: '2026-12-31',
    });
    expect(memo.repeatEnd).toBe('2026-12-31');

    const patched = await api(app).patch(`/api/memos/${memo.id}`).send({ repeat: 'none' });
    expect(patched.status).toBe(200);
    expect(patched.body.repeat).toBe('none');
    expect(patched.body.repeatEnd).toBeNull();
  });

  it('E49: optimistic lock rejects stale updatedAt (409)', async () => {
    const memo = await createMemo({ id: crypto.randomUUID(), title: 'Locked', date: '2026-11-12' });
    const stale = await api(app)
      .patch(`/api/memos/${memo.id}`)
      .send({ title: 'New title', updatedAt: '2020-01-01T00:00:00.000Z' });
    expect(stale.status).toBe(409);
    expect(stale.body.errorCode).toBe('CONCURRENT_MODIFICATION');

    const fresh = await api(app)
      .patch(`/api/memos/${memo.id}`)
      .send({ title: 'New title', updatedAt: memo.updatedAt });
    expect(fresh.status).toBe(200);
    expect(fresh.body.title).toBe('New title');
  });

  it('delete soft-removes the memo (404 afterwards)', async () => {
    const memo = await createMemo({ id: crypto.randomUUID(), title: 'To delete', date: '2026-11-12' });
    const res = await api(app).delete(`/api/memos/${memo.id}`);
    expect(res.status).toBe(204);
    const got = await api(app).get(`/api/memos/${memo.id}`);
    expect(got.status).toBe(404);
    expect(got.body.errorCode).toBe('MEMO_NOT_FOUND');
  });
});

describe('memo window listing', () => {
  it('returns non-repeating memos in range and repeating memos whose series intersects', async () => {
    await createMemo({ id: crypto.randomUUID(), title: 'In range', date: '2026-11-10' });
    await createMemo({ id: crypto.randomUUID(), title: 'Out of range', date: '2026-09-01' });
    // Long-running repeating memo: started far in the past, no end.
    await createMemo({
      id: crypto.randomUUID(),
      title: 'Daily forever',
      date: '2025-01-01',
      repeat: 'daily',
    });
    // Repeating memo whose series ended before the window.
    await createMemo({
      id: crypto.randomUUID(),
      title: 'Ended series',
      date: '2026-01-01',
      repeat: 'weekly',
      repeatEnd: '2026-01-31',
    });

    const res = await api(app).get('/api/memos?from=2026-11-01&to=2026-11-30');
    expect(res.status).toBe(200);
    const titles = (res.body as MemoDto[]).map((m) => m.title);
    expect(titles).toContain('In range');
    expect(titles).toContain('Daily forever');
    expect(titles).not.toContain('Out of range');
    expect(titles).not.toContain('Ended series');
  });

  it('rejects a malformed window (400) and an inverted window (422)', async () => {
    const bad = await api(app).get('/api/memos?from=not-a-date&to=2026-11-30');
    expect(bad.status).toBe(400);
    expect(bad.body.errorCode).toBe('VALIDATION_ERROR');

    const inverted = await api(app).get('/api/memos?from=2026-11-30&to=2026-11-01');
    expect(inverted.status).toBe(422);
  });
});

describe('memo completion', () => {
  it('non-repeating: toggles completedAt; wrong date is rejected (E51)', async () => {
    const memo = await createMemo({ id: crypto.randomUUID(), title: 'Once', date: '2026-11-12' });

    const done = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-12', completed: true });
    expect(done.status).toBe(200);
    expect(done.body.completedAt).not.toBeNull();
    expect(done.body.completions).toEqual([]);

    const wrongDate = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-13', completed: true });
    expect(wrongDate.status).toBe(422);
    expect(wrongDate.body.errorCode).toBe('VALIDATION_ERROR');

    const undone = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-12', completed: false });
    expect(undone.status).toBe(200);
    expect(undone.body.completedAt).toBeNull();
  });

  it('repeating: completes per instance date (E50) and re-completing is idempotent', async () => {
    // 2026-11-06 is a Friday; weekdays rule gives instances on 11-06/09/10...
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Standup',
      date: '2026-11-06',
      repeat: 'weekdays',
    });

    const notAnInstance = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-07', completed: true }); // a Saturday
    expect(notAnInstance.status).toBe(422);
    expect(notAnInstance.body.errorCode).toBe('MEMO_DATE_NOT_INSTANCE');

    const first = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-06', completed: true });
    expect(first.status).toBe(200);
    expect(first.body.completions).toEqual(['2026-11-06']);
    expect(first.body.completedAt).toBeNull();

    const second = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-09', completed: true });
    expect(second.body.completions).toEqual(['2026-11-06', '2026-11-09']);

    // Idempotent repeat of the same toggle.
    const again = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-06', completed: true });
    expect(again.status).toBe(200);
    expect(again.body.completions).toEqual(['2026-11-06', '2026-11-09']);

    // Un-completing one instance leaves the others untouched.
    const undone = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-06', completed: false });
    expect(undone.body.completions).toEqual(['2026-11-09']);
  });

  it('repeating: completion rows cascade when the memo is deleted', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Disposable',
      date: '2026-11-06',
      repeat: 'daily',
    });
    await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-07', completed: true });
    await api(app).delete(`/api/memos/${memo.id}`);
    const res = await api(app).get('/api/memos?from=2026-11-01&to=2026-11-30');
    expect((res.body as MemoDto[]).map((m) => m.id)).not.toContain(memo.id);
  });
});

describe('memo user isolation (E48)', () => {
  it('another user cannot see, update, complete or delete the memo', async () => {
    const memo = await createMemo({ id: crypto.randomUUID(), title: 'Private', date: '2026-11-12' });

    await registerTestUser(app, 'memo-m1-intruder');
    const list = await api(app).get('/api/memos?from=2026-11-01&to=2026-11-30');
    expect((list.body as MemoDto[]).map((m) => m.id)).not.toContain(memo.id);

    for (const [method, url, body] of [
      ['get', `/api/memos/${memo.id}`, undefined],
      ['patch', `/api/memos/${memo.id}`, { title: 'Hijack' }],
      ['put', `/api/memos/${memo.id}/completion`, { date: '2026-11-12', completed: true }],
    ] as const) {
      const res = await api(app)[method](url).send(body as object);
      expect(res.status, `${method} ${url}`).toBe(404);
      expect(res.body.errorCode).toBe('MEMO_NOT_FOUND');
    }
    const del = await api(app).delete(`/api/memos/${memo.id}`);
    expect(del.status).toBe(404);

    // The owner still has it untouched.
    setAuthToken(tokenA);
    const ownerView = await api(app).get(`/api/memos/${memo.id}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.title).toBe('Private');
  });
});

describe('custom repeat rule (weekday pick)', () => {
  it('stores repeatDays and expands per-instance completion (E50 semantics)', async () => {
    // 2026-11-02 is a Monday; repeat on Mondays and Thursdays.
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Custom days',
      date: '2026-11-02',
      repeat: 'custom',
      repeatDays: [4, 1, 1],
    });
    expect(memo.repeat).toBe('custom');

    const list = await api(app).get('/api/memos?from=2026-11-01&to=2026-11-15');
    const found = (list.body as (MemoDto & { repeatDays: number[] })[]).find(
      (m) => m.id === memo.id,
    );
    expect(found?.repeatDays).toEqual([1, 4]);

    // 2026-11-05 (Thursday) is an occurrence; 2026-11-06 (Friday) is not.
    const ok = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-05', completed: true });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const bad = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-06', completed: true });
    expect(bad.status).toBe(422);
    expect(bad.body.errorCode).toBe('MEMO_DATE_NOT_INSTANCE');
  });

  it('rejects custom without weekdays (422) and out-of-range days (400)', async () => {
    const missing = await api(app).post('/api/memos').send({
      id: crypto.randomUUID(),
      title: 'No days',
      date: '2026-11-02',
      repeat: 'custom',
    });
    expect(missing.status).toBe(422);
    expect(missing.body.errorCode).toBe('VALIDATION_ERROR');

    const outOfRange = await api(app).post('/api/memos').send({
      id: crypto.randomUUID(),
      title: 'Bad day',
      date: '2026-11-02',
      repeat: 'custom',
      repeatDays: [7],
    });
    expect(outOfRange.status).toBe(400);
  });

  it('clears repeatDays when switching back to a non-custom rule', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Switching',
      date: '2026-11-02',
      repeat: 'custom',
      repeatDays: [2],
    });
    const res = await api(app)
      .patch(`/api/memos/${memo.id}`)
      .send({ repeat: 'daily', repeatDays: [] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.repeatDays).toEqual([]);
  });

  it('legacy weekly / weekdays rules stay accepted for existing data', async () => {
    const weekly = await createMemo({
      id: crypto.randomUUID(),
      title: 'Legacy weekly',
      date: '2026-11-04',
      repeat: 'weekly',
    });
    expect(weekly.repeat).toBe('weekly');
  });
});

describe('per-instance deletion (excludedDates)', () => {
  it('deletes one instance of a repeating memo; others remain; idempotent', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Skip a day',
      date: '2026-11-04', // Wednesday, weekly
      repeat: 'weekly',
    });

    const res = await api(app).delete(`/api/memos/${memo.id}/instances/2026-11-11`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.excludedDates).toEqual(['2026-11-11']);

    // Repeat delete of the same date is a no-op (200, unchanged).
    const again = await api(app).delete(`/api/memos/${memo.id}/instances/2026-11-11`);
    expect(again.status).toBe(200);
    expect(again.body.excludedDates).toEqual(['2026-11-11']);

    // The excluded date is no longer a completable occurrence (E50)…
    const complete = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-11', completed: true });
    expect(complete.status).toBe(422);
    expect(complete.body.errorCode).toBe('MEMO_DATE_NOT_INSTANCE');

    // …while sibling occurrences still are.
    const sibling = await api(app)
      .put(`/api/memos/${memo.id}/completion`)
      .send({ date: '2026-11-18', completed: true });
    expect(sibling.status, JSON.stringify(sibling.body)).toBe(200);
  });

  it('rejects non-occurrence dates (422) and non-repeating memos (422)', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Weekly target',
      date: '2026-11-04',
      repeat: 'weekly',
    });
    const bad = await api(app).delete(`/api/memos/${memo.id}/instances/2026-11-05`);
    expect(bad.status).toBe(422);
    expect(bad.body.errorCode).toBe('MEMO_DATE_NOT_INSTANCE');

    const single = await createMemo({
      id: crypto.randomUUID(),
      title: 'One-off',
      date: '2026-11-05',
    });
    const notRepeating = await api(app).delete(`/api/memos/${single.id}/instances/2026-11-05`);
    expect(notRepeating.status).toBe(422);
    expect(notRepeating.body.errorCode).toBe('VALIDATION_ERROR');
  });
});
