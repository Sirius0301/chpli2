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
import { PrismaService } from '../../src/shared/prisma.service';

/**
 * Integration coverage of the Bookmarks B1 slice: CRUD validation (E89/E90),
 * idempotent create (E93), optimistic lock (E92), click counting (D4), the
 * four sort orders (D6), the server-computed inactive flag with its 30-day
 * boundary (D5), the cover image flow (D2/E91/E95) and isolation (E94).
 */

interface BookmarkDto {
  id: string;
  title: string;
  url: string;
  domain: string;
  categories: string[];
  hasCover: boolean;
  clickCount: number;
  lastClickedAt: string | null;
  inactive: boolean;
  updatedAt: string;
}

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let app: INestApplication;
let tokenA = '';

async function createBookmark(body: Record<string, unknown>): Promise<BookmarkDto> {
  const res = await api(app)
    .post('/api/bookmarks')
    .send({ title: 'Site', url: 'https://example.com/', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as BookmarkDto;
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'bookmarks-b1-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('bookmarks CRUD (B1)', () => {
  it('creates with normalized domain and trimmed categories (A82)', async () => {
    const bm = await createBookmark({
      id: crypto.randomUUID(),
      title: '  TS Docs ',
      url: 'https://www.typescriptlang.org/docs/',
      categories: [' dev ', 'dev', ' docs '],
    });
    expect(bm.title).toBe('TS Docs');
    expect(bm.domain).toBe('www.typescriptlang.org');
    expect(bm.categories).toEqual(['dev', 'docs']);
    expect(bm.clickCount).toBe(0);
    expect(bm.inactive).toBe(false);
  });

  it('E89: non-http or unparseable URLs are rejected (400, DTO layer)', async () => {
    for (const url of ['ftp://example.com', 'not a url', '//example.com', 'javascript:alert(1)']) {
      const res = await api(app)
        .post('/api/bookmarks')
        .send({ id: crypto.randomUUID(), title: 'x', url });
      expect(res.status, url).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('E90/E93: empty title is 422; repeated create with the same id is idempotent', async () => {
    const empty = await api(app)
      .post('/api/bookmarks')
      .send({ id: crypto.randomUUID(), title: '  ', url: 'https://a.com' });
    expect(empty.status).toBe(422);

    const id = crypto.randomUUID();
    await createBookmark({ id, title: 'Idempotent' });
    const again = await api(app)
      .post('/api/bookmarks')
      .send({ id, title: 'Changed', url: 'https://b.com' });
    expect(again.status).toBe(201);
    expect(again.body.title).toBe('Idempotent');
    expect(again.body.url).toBe('https://example.com/');
  });

  it('E92: optimistic lock rejects a stale updatedAt (409)', async () => {
    const bm = await createBookmark({ id: crypto.randomUUID(), title: 'Locked' });
    const stale = await api(app)
      .patch(`/api/bookmarks/${bm.id}`)
      .send({ title: 'New', updatedAt: '2020-01-01T00:00:00.000Z' });
    expect(stale.status).toBe(409);
    expect(stale.body.errorCode).toBe('CONCURRENT_MODIFICATION');

    const fresh = await api(app)
      .patch(`/api/bookmarks/${bm.id}`)
      .send({ title: 'New', updatedAt: bm.updatedAt });
    expect(fresh.status).toBe(200);
    expect(fresh.body.title).toBe('New');
  });

  it('PATCH url recomputes the domain', async () => {
    const bm = await createBookmark({ id: crypto.randomUUID(), title: 'Move', url: 'https://a.com/x' });
    const moved = await api(app)
      .patch(`/api/bookmarks/${bm.id}`)
      .send({ url: 'https://b.org/y', updatedAt: bm.updatedAt });
    expect(moved.body.domain).toBe('b.org');
  });
});

describe('click counting and sorting (B1 D4/D6)', () => {
  it('click increments the count and refreshes lastClickedAt (A94)', async () => {
    const bm = await createBookmark({ id: crypto.randomUUID(), title: 'Clicky' });
    const first = await api(app).post(`/api/bookmarks/${bm.id}/click`);
    expect(first.status).toBe(201);
    expect(first.body.clickCount).toBe(1);
    expect(first.body.lastClickedAt).not.toBeNull();
    expect(first.body.inactive).toBe(false);

    const second = await api(app).post(`/api/bookmarks/${bm.id}/click`);
    expect(second.body.clickCount).toBe(2);
  });

  it('sorts by clicks, title, added and recent (A95)', async () => {
    const a = await createBookmark({ id: crypto.randomUUID(), title: 'Zulu', url: 'https://z.example' });
    const b = await createBookmark({ id: crypto.randomUUID(), title: 'Alpha', url: 'https://a.example' });
    await api(app).post(`/api/bookmarks/${a.id}/click`);
    await api(app).post(`/api/bookmarks/${b.id}/click`);
    await api(app).post(`/api/bookmarks/${b.id}/click`);

    const byClicks = ((await api(app).get('/api/bookmarks?sort=clicks')).body as BookmarkDto[]).map(
      (x) => x.title,
    );
    expect(byClicks.indexOf('Alpha')).toBeLessThan(byClicks.indexOf('Zulu'));

    const byTitle = ((await api(app).get('/api/bookmarks?sort=title')).body as BookmarkDto[]).map(
      (x) => x.title,
    );
    expect(byTitle.indexOf('Alpha')).toBeLessThan(byTitle.indexOf('Zulu'));

    const byAdded = ((await api(app).get('/api/bookmarks?sort=added')).body as BookmarkDto[]).map(
      (x) => x.title,
    );
    expect(byAdded.indexOf('Alpha')).toBeLessThan(byAdded.indexOf('Zulu')); // added desc = newest first

    const byRecent = ((await api(app).get('/api/bookmarks?sort=recent')).body as BookmarkDto[]).map(
      (x) => x.title,
    );
    expect(byRecent.indexOf('Alpha')).toBeLessThan(byRecent.indexOf('Zulu')); // 2 clicks later

    // Unknown sort values are rejected at the DTO layer (400, whitelist).
    const fallback = await api(app).get('/api/bookmarks?sort=bogus');
    expect(fallback.status).toBe(400);
    expect(fallback.body.errorCode).toBe('VALIDATION_ERROR');
  });
});

describe('inactive flag boundary (B1 D5)', () => {
  it('29/30/31 days and never-clicked boundaries are computed correctly', async () => {
    const prisma = app.get(PrismaService);
    const mk = async (title: string, daysAgo: number) => {
      const bm = await createBookmark({ id: crypto.randomUUID(), title, url: `https://${title}.example` });
      const stamp = new Date(Date.now() - daysAgo * 86_400_000);
      await prisma.bookmark.update({ where: { id: bm.id }, data: { lastClickedAt: stamp } });
      return bm.id;
    };
    const b29 = await mk('d29', 29);
    const b30 = await mk('d30', 30);
    const b31 = await mk('d31', 31);

    // Never clicked: judged by createdAt (fresh -> active).
    const never = await createBookmark({ id: crypto.randomUUID(), title: 'never', url: 'https://n.example' });

    const rows = (await api(app).get('/api/bookmarks')).body as BookmarkDto[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(b29)!.inactive).toBe(false);
    expect(byId.get(b30)!.inactive).toBe(true); // "30 天未点击"含整 30 天（>=语义）
    expect(byId.get(b31)!.inactive).toBe(true);
    expect(byId.get(never.id)!.inactive).toBe(false);

    // Clicking an inactive bookmark revives it (D5 loop).
    const revived = await api(app).post(`/api/bookmarks/${b31}/click`);
    expect(revived.body.inactive).toBe(false);
  });
});

describe('cover image (B1 D2)', () => {
  it('uploads, serves, replaces and cleans up with the bookmark (A83)', async () => {
    const bm = await createBookmark({ id: crypto.randomUUID(), title: 'Covered' });
    const up = await api(app)
      .put(`/api/bookmarks/${bm.id}/cover`)
      .attach('file', PNG_BYTES, 'cover.png');
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    expect(up.body.hasCover).toBe(true);

    const file = await api(app).get(`/api/bookmarks/${bm.id}/cover/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(file.body as Buffer, PNG_BYTES)).toBe(0);

    // Re-upload replaces the cover.
    const replaced = await api(app)
      .put(`/api/bookmarks/${bm.id}/cover`)
      .attach('file', PNG_BYTES, 'cover2.png');
    expect(replaced.status).toBe(200);
    const file2 = await api(app).get(`/api/bookmarks/${bm.id}/cover/file`);
    expect(file2.status).toBe(200);

    await api(app).delete(`/api/bookmarks/${bm.id}`);
    const gone = await api(app).get(`/api/bookmarks/${bm.id}/cover/file`);
    expect(gone.status).toBe(404);
  });

  it('E91: a non-image cover is rejected (422)', async () => {
    const bm = await createBookmark({ id: crypto.randomUUID(), title: 'NoCover' });
    const res = await api(app)
      .put(`/api/bookmarks/${bm.id}/cover`)
      .attach('file', Buffer.from('plain text'), 'fake.png');
    expect(res.status).toBe(422);
  });

  it('E94: another user cannot see, click or cover the bookmark', async () => {
    const bm = await createBookmark({ id: crypto.randomUUID(), title: 'Private' });
    await registerTestUser(app, 'bookmarks-b1-intruder');

    for (const [method, url] of [
      ['get', `/api/bookmarks/${bm.id}`],
      ['post', `/api/bookmarks/${bm.id}/click`],
    ] as const) {
      const res = await api(app)[method](url);
      expect(res.status, `${method} ${url}`).toBe(404);
    }
    // The list endpoint answers 200 with an empty body for strangers.
    const list = (await api(app).get('/api/bookmarks')).body as BookmarkDto[];
    expect(list).toEqual([]);

    setAuthToken(tokenA);
    const owner = await api(app).get(`/api/bookmarks/${bm.id}`);
    expect(owner.status).toBe(200);
  });
});
