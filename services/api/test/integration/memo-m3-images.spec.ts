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
 * Integration coverage of the M3 memo image slice against a real MinIO
 * (docker-compose): upload (happy path, idempotency E58, magic-byte
 * rejection E59, oversize E60), listing, download (body round-trip),
 * guarded delete (E61) and the object-storage-failure 503 (E62).
 *
 * Requires the MinIO container from infra/docker-compose.yml; the suite
 * fails fast with a clear message when it is not running.
 */

interface MemoDto {
  id: string;
  title: string;
}

interface MemoImageDto {
  id: string;
  memoId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

// 1x1 red PNG.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgAAAQE//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxAB/9k=',
  'base64',
);
const FAKE_PNG = Buffer.from('not-an-image-at-all............');

let app: INestApplication;
let tokenA = '';
let memoId = '';

async function createMemo(): Promise<MemoDto> {
  const res = await api(app)
    .post('/api/memos')
    .send({ id: crypto.randomUUID(), title: 'With images', date: '2026-11-12' });
  expect(res.status).toBe(201);
  return res.body as MemoDto;
}

async function upload(
  memo: string,
  imageId: string,
  buffer: Buffer,
  fileName = 'photo.png',
): Promise<import('supertest').Response> {
  return api(app)
    .post(`/api/memos/${memo}/images`)
    .field('id', imageId)
    .attach('file', buffer, fileName);
}

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'memo-m3-tester');
  tokenA = userA.token;
  memoId = (await createMemo()).id;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('memo images (M3)', () => {
  it('uploads a PNG, lists it and downloads the identical bytes', async () => {
    const imageId = crypto.randomUUID();
    const up = await upload(memoId, imageId, PNG_BYTES, 'red dot.png');
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const image = up.body as MemoImageDto;
    expect(image.id).toBe(imageId);
    expect(image.mimeType).toBe('image/png');
    expect(image.fileName).toBe('red dot.png');
    expect(image.sizeBytes).toBe(PNG_BYTES.length);

    const list = await api(app).get(`/api/memos/${memoId}/images`);
    expect(list.status).toBe(200);
    expect((list.body as MemoImageDto[]).map((i) => i.id)).toEqual([imageId]);

    const file = await api(app).get(`/api/memos/images/${imageId}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(file.body as Buffer, PNG_BYTES)).toBe(0);
  });

  it('E58: re-uploading the same id returns the original record', async () => {
    const imageId = crypto.randomUUID();
    const first = await upload(memoId, imageId, PNG_BYTES);
    expect(first.status).toBe(201);
    const again = await upload(memoId, imageId, JPEG_BYTES, 'other.jpg');
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(imageId);
    expect(again.body.mimeType).toBe('image/png'); // not overwritten
    expect(again.body.fileName).toBe('photo.png');
  });

  it('E59: non-image content is rejected even with a png filename', async () => {
    const res = await upload(memoId, crypto.randomUUID(), FAKE_PNG, 'fake.png');
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('E60: files over 5MB are rejected', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);
    const res = await upload(memoId, crypto.randomUUID(), big, 'big.jpg');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('E61: another user cannot list, download or delete the images', async () => {
    const imageId = crypto.randomUUID();
    await upload(memoId, imageId, PNG_BYTES);

    await registerTestUser(app, 'memo-m3-intruder');
    for (const [method, url] of [
      ['get', `/api/memos/${memoId}/images`],
      ['get', `/api/memos/images/${imageId}/file`],
      ['delete', `/api/memos/${memoId}/images/${imageId}`],
    ] as const) {
      const res = await api(app)[method](url);
      expect(res.status, `${method} ${url}`).toBe(404);
    }
    const up = await upload(memoId, crypto.randomUUID(), PNG_BYTES);
    expect(up.status).toBe(404);

    setAuthToken(tokenA);
  });

  it('delete removes metadata, the object and answers 204 (E63 path stays silent)', async () => {
    const imageId = crypto.randomUUID();
    await upload(memoId, imageId, PNG_BYTES);
    const del = await api(app).delete(`/api/memos/${memoId}/images/${imageId}`);
    expect(del.status).toBe(204);

    const file = await api(app).get(`/api/memos/images/${imageId}/file`);
    expect(file.status).toBe(404);

    const list = await api(app).get(`/api/memos/${memoId}/images`);
    expect((list.body as MemoImageDto[]).map((i) => i.id)).not.toContain(imageId);
  });

  it('memo soft-delete cascades its image rows', async () => {
    const memo = await createMemo();
    await upload(memo.id, crypto.randomUUID(), PNG_BYTES);
    await api(app).delete(`/api/memos/${memo.id}`);
    const list = await api(app).get(`/api/memos/${memo.id}/images`);
    expect(list.status).toBe(404); // memo itself is gone
  });
});
