import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  api,
  createTestApp,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
} from '../helpers';

/**
 * Integration coverage of the M2 memo slice: tags validation (E52),
 * two-level filtering (tags AND / priorities OR, A49/A50), the tag
 * aggregate endpoint (A51) and cross-user isolation of tag data.
 */

interface MemoDto {
  id: string;
  title: string;
  date: string;
  priority: string;
  repeat: string;
  tags: string[];
}

interface TagCountDto {
  tag: string;
  count: number;
}

let app: INestApplication;

async function createMemo(body: Record<string, unknown>): Promise<MemoDto> {
  const res = await api(app)
    .post('/api/memos')
    .send({ title: 'Test memo', priority: 'none', repeat: 'none', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as MemoDto;
}

async function listTitles(query: string): Promise<string[]> {
  const res = await api(app).get(`/api/memos?from=2026-11-01&to=2026-11-30${query}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return (res.body as MemoDto[]).map((m) => m.title);
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  await registerTestUser(app, 'memo-m2-tester');
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('memo tags (M2)', () => {
  it('stores tags on create, trims and dedupes them (A48)', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Tagged',
      date: '2026-11-10',
      tags: [' work ', 'work', ' urgent '],
    });
    expect(memo.tags).toEqual(['work', 'urgent']);
  });

  it('E52: empty tags are 422 (service); oversized / too many are 400 (DTO layer)', async () => {
    const empty = await api(app)
      .post('/api/memos')
      .send({ id: crypto.randomUUID(), title: 'x', date: '2026-11-10', tags: ['  '] });
    expect(empty.status).toBe(422);
    expect(empty.body.errorCode).toBe('VALIDATION_ERROR');

    const oversized = await api(app)
      .post('/api/memos')
      .send({
        id: crypto.randomUUID(),
        title: 'x',
        date: '2026-11-10',
        tags: ['a'.repeat(33)],
      });
    expect(oversized.status).toBe(400);
    expect(oversized.body.errorCode).toBe('VALIDATION_ERROR');

    const tooMany = await api(app)
      .post('/api/memos')
      .send({
        id: crypto.randomUUID(),
        title: 'x',
        date: '2026-11-10',
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      });
    expect(tooMany.status).toBe(400);
  });

  it('PATCH replaces the tag set wholesale', async () => {
    const memo = await createMemo({
      id: crypto.randomUUID(),
      title: 'Retag',
      date: '2026-11-10',
      tags: ['old'],
    });
    const res = await api(app).patch(`/api/memos/${memo.id}`).send({ tags: ['new'] });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['new']);
  });
});

describe('two-level filtering (M2)', () => {
  beforeAll(async () => {
    await createMemo({ id: crypto.randomUUID(), title: 'F-work-home', date: '2026-11-05', tags: ['work', 'home'], priority: 'high' });
    await createMemo({ id: crypto.randomUUID(), title: 'F-work-only', date: '2026-11-06', tags: ['work'], priority: 'low' });
    await createMemo({ id: crypto.randomUUID(), title: 'F-home-medium', date: '2026-11-07', tags: ['home'], priority: 'medium' });
    await createMemo({ id: crypto.randomUUID(), title: 'F-none-top', date: '2026-11-08', priority: 'high' });
  });

  it('single tag filter matches tagged memos only (A49)', async () => {
    const titles = await listTitles('&tags=work');
    expect(titles).toContain('F-work-home');
    expect(titles).toContain('F-work-only');
    expect(titles).not.toContain('F-home-medium');
  });

  it('two tags use AND semantics: only memos carrying both (A49)', async () => {
    const titles = await listTitles('&tags=work,home');
    expect(titles).toEqual(['F-work-home']);
  });

  it('AND with no shared memo yields an empty list (E54)', async () => {
    const titles = await listTitles('&tags=work,missing');
    expect(titles).toEqual([]);
  });

  it('priority filter uses OR semantics (A50)', async () => {
    const titles = await listTitles('&priorities=high,medium');
    expect(titles).toContain('F-work-home');
    expect(titles).toContain('F-home-medium');
    expect(titles).toContain('F-none-top');
    expect(titles).not.toContain('F-work-only');
  });

  it('tag AND + priority OR combine with AND between levels (A50)', async () => {
    const titles = await listTitles('&tags=work&priorities=low');
    expect(titles).toEqual(['F-work-only']);
  });

  it('E53: invalid priority enum in the filter is rejected (422)', async () => {
    const res = await api(app).get('/api/memos?from=2026-11-01&to=2026-11-30&priorities=urgent');
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('E52: oversized tag in the filter is rejected (422)', async () => {
    const res = await api(app).get(
      `/api/memos?from=2026-11-01&to=2026-11-30&tags=${'a'.repeat(33)}`,
    );
    expect(res.status).toBe(422);
  });
});

describe('tag aggregate (M2)', () => {
  it('aggregates tags with counts across all memos, independent of the window (A51)', async () => {
    const res = await api(app).get('/api/memos/tags');
    expect(res.status).toBe(200);
    const tags = res.body as TagCountDto[];
    const byTag = new Map(tags.map((t) => [t.tag, t.count]));
    expect(byTag.get('work')).toBe(3); // F-work-home, F-work-only, Tagged
    expect(byTag.get('home')).toBe(2); // F-work-home, F-home-medium
    expect(byTag.get('missing')).toBeUndefined();
    // Sorted by count desc.
    for (let i = 1; i < tags.length; i += 1) {
      expect(tags[i - 1]!.count).toBeGreaterThanOrEqual(tags[i]!.count);
    }
  });

  it('excludes other users\' tags (E48)', async () => {
    await registerTestUser(app, 'memo-m2-intruder');
    const res = await api(app).get('/api/memos/tags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
