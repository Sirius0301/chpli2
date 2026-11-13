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
 * Integration coverage of the Notes N2 slice: full-text search (D3),
 * wiki backlinks (D2), version history write/prune/restore (D4/D5), note
 * images (D6, same semantics as memo images) and isolation (E86).
 */

interface NoteDto {
  id: string;
  title: string;
  body: string;
  tags: string[];
  updatedAt: string;
}

interface NoteVersionDto {
  seq: number;
  title: string;
  body: string;
}

interface NoteImageDto {
  id: string;
  noteId: string;
  mimeType: string;
}

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let app: INestApplication;
let tokenA = '';

async function createNote(body: Record<string, unknown>): Promise<NoteDto> {
  const res = await api(app).post('/api/notes').send({ title: 'T', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as NoteDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'notes-n2-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('full-text search (N2 D3)', () => {
  beforeAll(async () => {
    await createNote({ id: crypto.randomUUID(), title: 'Quarterly Review', body: 'nothing here', tags: ['work'] });
    await createNote({ id: crypto.randomUUID(), title: 'plain', body: 'The QUARTERLY numbers look fine.', tags: [] });
    await createNote({ id: crypto.randomUUID(), title: 'tagged', body: '', tags: ['Quarterly'] });
  });

  it('matches title and body case-insensitively, tags exactly (A76)', async () => {
    const byTitle = (await api(app).get('/api/notes?q=quarterly')).body as NoteDto[];
    expect(byTitle.map((n) => n.title)).toContain('Quarterly Review');
    expect(byTitle.map((n) => n.title)).toContain('plain'); // body hit, case-insensitive
    expect(byTitle.map((n) => n.title)).not.toContain('tagged'); // tags are case-sensitive
  });

  it('combines q with filters (AND)', async () => {
    const res = (await api(app).get('/api/notes?q=quarterly&tags=work')).body as NoteDto[];
    expect(res.map((n) => n.title)).toEqual(['Quarterly Review']);
  });

  it('rejects an over-long q (E83)', async () => {
    const res = await api(app).get(`/api/notes?q=${'a'.repeat(129)}`);
    expect(res.status).toBe(400);
  });
});

describe('wiki backlinks (N2 D1/D2)', () => {
  it('resolves backlinks by literal [[id]] token and hides deleted notes (E84)', async () => {
    const target = await createNote({ id: crypto.randomUUID(), title: 'Target' });
    const refA = await createNote({ id: crypto.randomUUID(), title: 'Ref A', body: `see [[${target.id}]]` });
    await createNote({ id: crypto.randomUUID(), title: 'Ref B', body: `also [[${target.id}]] and text` });

    let links = (await api(app).get(`/api/notes/${target.id}/backlinks`)).body as { id: string; title: string }[];
    expect(links.map((l) => l.title).sort()).toEqual(['Ref A', 'Ref B']);

    await api(app).delete(`/api/notes/${refA.id}`);
    links = (await api(app).get(`/api/notes/${target.id}/backlinks`)).body as { id: string; title: string }[];
    expect(links.map((l) => l.title)).toEqual(['Ref B']); // soft-deleted referrer gone
  });
});

describe('version history (N2 D4/D5)', () => {
  it('records a version per update and restores as a new revision (A79)', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'v1 title', body: 'v1 body' });
    await api(app).patch(`/api/notes/${note.id}`).send({ title: 'v2 title' });
    await api(app).patch(`/api/notes/${note.id}`).send({ body: 'v3 body' });

    const versions = (await api(app).get(`/api/notes/${note.id}/versions`)).body as NoteVersionDto[];
    expect(versions.map((v) => v.seq)).toEqual([3, 2, 1]);
    expect(versions[2]!.title).toBe('v1 title');
    expect(versions[0]!.body).toBe('v3 body');

    // Restore v1: content rolls back AND history gains two rows
    // (pre-restore snapshot + the restore revision) — never rewritten.
    const restored = await api(app).post(`/api/notes/${note.id}/versions/1/restore`);
    expect(restored.status).toBe(201);
    expect(restored.body.title).toBe('v1 title');
    expect(restored.body.body).toBe('v1 body');

    const after = (await api(app).get(`/api/notes/${note.id}/versions`)).body as NoteVersionDto[];
    expect(after.map((v) => v.seq)).toEqual([5, 4, 3, 2, 1]);
    expect(after[0]!.body).toBe('v1 body'); // the restore revision
    expect(after[1]!.body).toBe('v3 body'); // pre-restore snapshot
  });

  it('prunes versions beyond the keep limit (D4)', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'prune' });
    for (let i = 0; i < 60; i += 1) {
      await api(app).patch(`/api/notes/${note.id}`).send({ body: `edit ${i}` });
    }
    const versions = (await api(app).get(`/api/notes/${note.id}/versions`)).body as NoteVersionDto[];
    expect(versions.length).toBe(50);
    expect(versions[0]!.seq).toBe(61); // create(1) + 60 edits
  });

  it('E83/E87: unknown seq or deleted note -> 404', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'x' });
    const bad = await api(app).post(`/api/notes/${note.id}/versions/999/restore`);
    expect(bad.status).toBe(404);
    expect(bad.body.errorCode).toBe('NOTE_VERSION_NOT_FOUND');

    await api(app).delete(`/api/notes/${note.id}`);
    const gone = await api(app).get(`/api/notes/${note.id}/versions`);
    expect(gone.status).toBe(404);
  });
});

describe('note images (N2 D6)', () => {
  it('uploads, lists, downloads and deletes (A80)', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'with image' });
    const imageId = crypto.randomUUID();
    const up = await api(app)
      .post(`/api/notes/${note.id}/images`)
      .field('id', imageId)
      .attach('file', PNG_BYTES, 'dot.png');
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    expect(up.body.mimeType).toBe('image/png');

    const list = (await api(app).get(`/api/notes/${note.id}/images`)).body as NoteImageDto[];
    expect(list.map((i) => i.id)).toEqual([imageId]);

    const file = await api(app).get(`/api/notes/images/${imageId}/file`);
    expect(file.status).toBe(200);
    expect(Buffer.compare(file.body as Buffer, PNG_BYTES)).toBe(0);

    // Idempotent re-upload (E85/E58 semantics)
    const again = await api(app)
      .post(`/api/notes/${note.id}/images`)
      .field('id', imageId)
      .attach('file', PNG_BYTES, 'other.png');
    expect(again.body.fileName).toBe('dot.png');

    const del = await api(app).delete(`/api/notes/${note.id}/images/${imageId}`);
    expect(del.status).toBe(204);
    const gone = await api(app).get(`/api/notes/images/${imageId}/file`);
    expect(gone.status).toBe(404);
  });

  it('E86: another user cannot touch the images', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: 'private img' });
    const imageId = crypto.randomUUID();
    await api(app)
      .post(`/api/notes/${note.id}/images`)
      .field('id', imageId)
      .attach('file', PNG_BYTES, 'x.png');

    await registerTestUser(app, 'notes-n2-intruder');
    const list = await api(app).get(`/api/notes/${note.id}/images`);
    expect(list.status).toBe(404);
    const file = await api(app).get(`/api/notes/images/${imageId}/file`);
    expect(file.status).toBe(404);

    setAuthToken(tokenA);
  });
});
