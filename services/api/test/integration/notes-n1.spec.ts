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
 * Integration coverage of the Notes N1 slice: CRUD (E77/E79/E80), optimistic
 * locking (E78), tag/priority filtering with the Memo M2 semantics, and the
 * tag aggregate endpoint.
 */

interface NoteDto {
  id: string;
  title: string;
  body: string;
  priority: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

let app: INestApplication;
let tokenA = '';

async function createNote(body: Record<string, unknown>): Promise<NoteDto> {
  const res = await api(app)
    .post('/api/notes')
    .send({ title: 'Test note', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as NoteDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'notes-n1-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('notes CRUD (N1)', () => {
  it('creates a note with defaults and reads it back (A70)', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'First note', body: '# Hello' });
    expect(note.priority).toBe('none');
    expect(note.tags).toEqual([]);
    expect(note.body).toBe('# Hello');

    const got = await api(app).get(`/api/notes/${note.id}`);
    expect(got.status).toBe(200);
    expect(got.body.title).toBe('First note');
  });

  it('E79: a repeated create with the same id returns the original record', async () => {
    const id = crypto.randomUUID();
    const first = await createNote({ id, title: 'Idempotent' });
    const again = await api(app)
      .post('/api/notes')
      .send({ id, title: 'Changed', body: 'changed' });
    expect(again.status).toBe(201);
    expect(again.body.title).toBe(first.title);
  });

  it('E77: empty title and oversized body are rejected', async () => {
    const empty = await api(app)
      .post('/api/notes')
      .send({ id: crypto.randomUUID(), title: '  ' });
    expect(empty.status).toBe(422);

    const huge = await api(app)
      .post('/api/notes')
      .send({ id: crypto.randomUUID(), title: 'x', body: 'a'.repeat(100_001) });
    expect(huge.status).toBe(400); // DTO layer (MaxLength counts chars, >= bytes for ascii)
  });

  it('stores tags trimmed and deduped; PATCH replaces them wholesale (A72)', async () => {
    const note = await createNote({
      id: crypto.randomUUID(),
      title: 'Tagged',
      tags: [' work ', 'work', ' ideas '],
    });
    expect(note.tags).toEqual(['work', 'ideas']);
    const patched = await api(app).patch(`/api/notes/${note.id}`).send({ tags: ['solo'] });
    expect(patched.status).toBe(200);
    expect(patched.body.tags).toEqual(['solo']);
  });

  it('E78: optimistic lock rejects a stale updatedAt (409)', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'Locked' });
    const stale = await api(app)
      .patch(`/api/notes/${note.id}`)
      .send({ title: 'New', updatedAt: '2020-01-01T00:00:00.000Z' });
    expect(stale.status).toBe(409);
    expect(stale.body.errorCode).toBe('CONCURRENT_MODIFICATION');

    const fresh = await api(app)
      .patch(`/api/notes/${note.id}`)
      .send({ title: 'New', updatedAt: note.updatedAt });
    expect(fresh.status).toBe(200);
    expect(fresh.body.title).toBe('New');
  });

  it('filters by a createdAt window (Memo day view) and rejects an inverted range', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'created-window' });
    const now = Date.now();
    const from = new Date(now - 60_000).toISOString();
    const to = new Date(now + 60_000).toISOString();
    const hits = await api(app).get('/api/notes').query({ createdFrom: from, createdTo: to });
    expect(hits.status).toBe(200);
    expect((hits.body as NoteDto[]).map((n) => n.id)).toContain(note.id);

    const future = await api(app)
      .get('/api/notes')
      .query({
        createdFrom: new Date(now + 3_600_000).toISOString(),
        createdTo: new Date(now + 7_200_000).toISOString(),
      });
    expect(future.status).toBe(200);
    expect((future.body as NoteDto[]).map((n) => n.id)).not.toContain(note.id);

    const inverted = await api(app)
      .get('/api/notes')
      .query({ createdFrom: to, createdTo: from });
    expect(inverted.status).toBe(422);
  });

  it('lists notes by updatedAt desc and deletes softly (404 afterwards)', async () => {
    const a = await createNote({ id: crypto.randomUUID(), title: 'Older' });
    const b = await createNote({ id: crypto.randomUUID(), title: 'Newer' });
    await api(app).patch(`/api/notes/${a.id}`).send({ body: 'touch' }); // a updated last

    const list = await api(app).get('/api/notes');
    const titles = (list.body as NoteDto[]).map((n) => n.title);
    expect(titles.indexOf('Older')).toBeLessThan(titles.indexOf('Newer'));

    await api(app).delete(`/api/notes/${b.id}`);
    const gone = await api(app).get(`/api/notes/${b.id}`);
    expect(gone.status).toBe(404);
    expect(gone.body.errorCode).toBe('NOTE_NOT_FOUND');
  });
});

describe('notes filtering (N1 A72)', () => {
  beforeAll(async () => {
    await createNote({ id: crypto.randomUUID(), title: 'N-work-home', tags: ['work', 'home'], priority: 'high' });
    await createNote({ id: crypto.randomUUID(), title: 'N-work-only', tags: ['work'], priority: 'low' });
    await createNote({ id: crypto.randomUUID(), title: 'N-home-only', tags: ['home'], priority: 'medium' });
  });

  it('tag filter AND / priority filter OR / combined (Memo M2 semantics)', async () => {
    const byTag = (await api(app).get('/api/notes?tags=work')).body as NoteDto[];
    expect(byTag.map((n) => n.title)).toContain('N-work-home');
    expect(byTag.map((n) => n.title)).toContain('N-work-only');
    expect(byTag.map((n) => n.title)).not.toContain('N-home-only');

    const and = (await api(app).get('/api/notes?tags=work,home')).body as NoteDto[];
    expect(and.map((n) => n.title)).toEqual(['N-work-home']);

    const or = (await api(app).get('/api/notes?priorities=high,medium')).body as NoteDto[];
    expect(or.map((n) => n.title)).toContain('N-work-home');
    expect(or.map((n) => n.title)).toContain('N-home-only');
    expect(or.map((n) => n.title)).not.toContain('N-work-only');

    const combined = (await api(app).get('/api/notes?tags=work&priorities=low')).body as NoteDto[];
    expect(combined.map((n) => n.title)).toEqual(['N-work-only']);
  });

  it('tag aggregate counts all notes and ignores active filters', async () => {
    const res = await api(app).get('/api/notes/tags');
    expect(res.status).toBe(200);
    const tags = res.body as { tag: string; count: number }[];
    const byTag = new Map(tags.map((t) => [t.tag, t.count]));
    expect(byTag.get('work')).toBeGreaterThanOrEqual(2); // N-work-home, N-work-only
    expect(byTag.get('home')).toBeGreaterThanOrEqual(2); // N-work-home, N-home-only
  });
});

describe('notes user isolation (N1 E80)', () => {
  it('another user cannot see, update or delete the note', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'Private' });
    await registerTestUser(app, 'notes-n1-intruder');

    const list = await api(app).get('/api/notes');
    expect((list.body as NoteDto[]).map((n) => n.id)).not.toContain(note.id);
    const got = await api(app).get(`/api/notes/${note.id}`);
    expect(got.status).toBe(404);
    const patched = await api(app).patch(`/api/notes/${note.id}`).send({ title: 'Hijack' });
    expect(patched.status).toBe(404);
    const del = await api(app).delete(`/api/notes/${note.id}`);
    expect(del.status).toBe(404);
    const tags = await api(app).get('/api/notes/tags');
    expect(tags.body).toEqual([]);

    setAuthToken(tokenA);
    const owner = await api(app).get(`/api/notes/${note.id}`);
    expect(owner.status).toBe(200);
  });
});
