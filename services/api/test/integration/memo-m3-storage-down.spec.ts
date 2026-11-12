import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import {
  api,
  migrateDeploy,
  registerTestUser,
  resetDatabase,
} from '../helpers';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ObjectStorageService } from '../../src/memo/storage.service';

/**
 * E62: when object storage is unreachable, uploads/downloads answer
 * 503 STORAGE_UNAVAILABLE while the rest of the API keeps working. The
 * ObjectStorageService is replaced with a always-failing stub.
 */

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let app: INestApplication;
let memoId = '';

beforeAll(async () => {
  migrateDeploy();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ObjectStorageService)
    .useValue({
      ensureBucket: async () => {},
      put: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:1');
      },
      get: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:1');
      },
      remove: async () => {},
    })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await resetDatabase(app);
  await registerTestUser(app, 'memo-m3-e62');
  const res = await api(app)
    .post('/api/memos')
    .send({ id: crypto.randomUUID(), title: 'storage down', date: '2026-11-12' });
  memoId = res.body.id as string;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

describe('object storage failure (M3 E62)', () => {
  it('upload answers 503 STORAGE_UNAVAILABLE', async () => {
    const res = await api(app)
      .post(`/api/memos/${memoId}/images`)
      .field('id', crypto.randomUUID())
      .attach('file', PNG_BYTES, 'x.png');
    expect(res.status).toBe(503);
    expect(res.body.errorCode).toBe('STORAGE_UNAVAILABLE');
  });

  it('the memo API itself still works', async () => {
    const res = await api(app).get(`/api/memos/${memoId}`);
    expect(res.status).toBe(200);
  });
});
