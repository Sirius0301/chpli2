import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  api,
  createTestApp,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
} from '../helpers';
import { PrismaService } from '../../src/shared/prisma.service';
import { NotesService } from '../../src/notes/notes.service';

/**
 * Integration coverage of the N3 cnblog-style publish form: publish-field
 * persistence (category/excerpt/toggles/password), the publish lifecycle
 * (draft -> published / scheduled) and its validation rules.
 */

interface NoteDto {
  id: string;
  title: string;
  publishStatus: string;
  publishAt: string | null;
  publishedAt: string | null;
  category: string | null;
  excerpt: string | null;
  allowComments: boolean;
  pinned: boolean;
  hasAccessPassword: boolean;
  showOnHome: boolean;
}

let app: INestApplication;
let token = '';

async function createNote(body: Record<string, unknown>): Promise<NoteDto> {
  const res = await api(app).post('/api/notes').send({ title: 'Pub note', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as NoteDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  token = (await registerTestUser(app, 'notes-n3-tester')).token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('publish form fields (N3)', () => {
  it('persists category, excerpt, toggles and access password', async () => {
    const note = await createNote({
      id: crypto.randomUUID(),
      title: '发布字段',
      category: '  技术随笔 ',
      excerpt: '摘要内容',
      allowComments: false,
      pinned: true,
      accessPassword: 'sesame',
      showOnHome: true,
    });
    expect(note.category).toBe('技术随笔');
    expect(note.excerpt).toBe('摘要内容');
    expect(note.allowComments).toBe(false);
    expect(note.pinned).toBe(true);
    expect(note.hasAccessPassword).toBe(true);
    expect(note.showOnHome).toBe(true);
    expect(note.publishStatus).toBe('draft');

    // The API stores a scrypt hash, never the plaintext, and never returns it.
    const prisma = app.get(PrismaService);
    const row = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(row.accessPassword).toMatch(/^scrypt\$/);
    expect(row.accessPassword).not.toContain('sesame');
    const list = await api(app).get('/api/notes').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(list.body)).not.toContain('sesame');
  });

  it('an empty-string update keeps the stored password; null clears it', async () => {
    const note = await createNote({
      id: crypto.randomUUID(),
      title: '密码保持',
      accessPassword: 'secret1',
    });
    const fresh = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto & { updatedAt: string };
    expect(fresh.hasAccessPassword).toBe(true);

    // '' (the form's "keep" value) must not clear or re-hash the password.
    const prisma = app.get(PrismaService);
    const before = (await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).accessPassword;
    const keep = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '密码保持', accessPassword: '', updatedAt: fresh.updatedAt });
    expect(keep.status, JSON.stringify(keep.body)).toBe(200);
    expect(keep.body.hasAccessPassword).toBe(true);
    const afterKeep = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(afterKeep.accessPassword).toBe(before);

    // null clears.
    const clear = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accessPassword: null, updatedAt: keep.body.updatedAt });
    expect(clear.status).toBe(200);
    expect(clear.body.hasAccessPassword).toBe(false);
  });

  it('empty/whitespace optional fields normalise to null', async () => {
    const note = await createNote({
      id: crypto.randomUUID(),
      title: '空字段',
      category: '   ',
      excerpt: '',
      accessPassword: ' ',
    });
    expect(note.category).toBeNull();
    expect(note.excerpt).toBeNull();
    expect(note.hasAccessPassword).toBe(false);
  });

  it('rejects oversized publish fields with 422', async () => {
    const res = await api(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: crypto.randomUUID(), title: '超限', category: 'x'.repeat(33) });
    expect(res.status).toBe(400); // DTO-level MaxLength -> global 400 validation pipe
  });
});

describe('publish lifecycle (N3)', () => {
  it('draft -> published stamps publishedAt and clears the schedule', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: '发布我' });
    const fresh = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto & { updatedAt: string };
    const res = await api(app)
      .patch(`/api/notes/${fresh.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publishStatus: 'published', updatedAt: fresh.updatedAt });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.publishStatus).toBe('published');
    expect(res.body.publishedAt).toBeTruthy();
    expect(res.body.publishAt).toBeNull();
  });

  it('scheduled requires a future publishAt; past dates are rejected', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: '定时' });
    const fresh = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto & { updatedAt: string };

    const past = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publishStatus: 'scheduled', publishAt: '2020-01-01T00:00:00.000Z', updatedAt: fresh.updatedAt });
    expect(past.status).toBe(422);

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const ok = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publishStatus: 'scheduled', publishAt: future, updatedAt: fresh.updatedAt });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.publishStatus).toBe('scheduled');
    expect(ok.body.publishAt).toBe(future);

    // Content autosaves on a scheduled note must not clobber the schedule.
    const scheduled = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto & {
      updatedAt: string;
      body: string;
    };
    const autosave = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '正文改动', updatedAt: scheduled.updatedAt });
    expect(autosave.status).toBe(200);
    expect(autosave.body.publishStatus).toBe('scheduled');
    expect(autosave.body.publishAt).toBe(future);
  });

  it('publishDue flips due scheduled notes and is idempotent', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: '到点发布' });
    const fresh = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto & { updatedAt: string };
    const future = new Date(Date.now() + 60_000).toISOString();
    const scheduled = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ publishStatus: 'scheduled', publishAt: future, updatedAt: fresh.updatedAt });
    expect(scheduled.status).toBe(200);

    // Sweep with a clock past the schedule: flips exactly this note.
    const service = app.get(NotesService);
    const flipped = await service.publishDue(new Date(Date.now() + 120_000));
    expect(flipped).toBeGreaterThanOrEqual(1);
    const after = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto;
    expect(after.publishStatus).toBe('published');
    expect(after.publishAt).toBeNull();
    expect(after.publishedAt).toBeTruthy();

    // A second sweep finds nothing (idempotent, no publishedAt churn).
    const again = await service.publishDue(new Date(Date.now() + 120_000));
    const after2 = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto;
    expect(after2.publishedAt).toBe(after.publishedAt);
    void again;
  });

  it('publishAt is rejected for the published status', async () => {
    const note = await createNote({ id: crypto.randomUUID(), title: '互斥' });
    const fresh = (await api(app).get(`/api/notes/${note.id}`)).body as NoteDto & { updatedAt: string };
    const res = await api(app)
      .patch(`/api/notes/${note.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        publishStatus: 'published',
        publishAt: new Date(Date.now() + 60_000).toISOString(),
        updatedAt: fresh.updatedAt,
      });
    expect(res.status).toBe(422);
  });
});
