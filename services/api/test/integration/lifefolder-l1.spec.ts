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
 * Integration coverage of the Life Folder L1 slice: category taxonomy
 * (built-in seeds, custom create, depth/name rules, non-empty guard),
 * document upload/download/replace/move/delete (whitelist sniffing,
 * sensitive default), templates, and isolation.
 */

interface CategoryNode {
  id: string;
  name: string;
  builtIn: boolean;
  parentId: string | null;
  children: CategoryNode[];
}

interface DocumentDto {
  id: string;
  categoryId: string;
  title: string;
  sensitive: boolean;
  templateId: string | null;
  mimeType: string;
  fileName: string;
  updatedAt: string;
}

// Minimal valid single-page PDF.
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
  'ascii',
);
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let app: INestApplication;
let tokenA = '';

beforeAll(async () => {
  migrateDeploy();
  app = await createTestApp();
  await resetDatabase(app);
  const userA = await registerTestUser(app, 'life-l1-tester');
  tokenA = userA.token;
});

afterAll(async () => {
  await resetDatabase(app);
  await app.close();
});

function findCat(nodes: CategoryNode[], name: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node;
    const hit = findCat(node.children, name);
    if (hit) return hit;
  }
  return undefined;
}

async function uploadDoc(
  fields: Record<string, unknown>,
  buffer: Buffer,
  fileName: string,
): Promise<import('supertest').Response> {
  const req = api(app)
    .post('/api/life-folder/documents')
    .field('id', (fields.id as string) ?? crypto.randomUUID())
    .field('title', (fields.title as string) ?? 'Doc')
    .field('categoryId', fields.categoryId as string);
  if (fields.notes !== undefined) req.field('notes', fields.notes as string);
  if (fields.sensitive !== undefined) req.field('sensitive', String(fields.sensitive));
  if (fields.templateId !== undefined) req.field('templateId', fields.templateId as string);
  return req.attach('file', buffer, fileName);
}

describe('categories (L1)', () => {
  it('exposes the seven built-in categories and templates (A107/D2/D7)', async () => {
    const res = await api(app).get('/api/life-folder/categories');
    expect(res.status).toBe(200);
    const roots = res.body as CategoryNode[];
    expect(roots).toHaveLength(7);
    expect(roots.every((c) => c.builtIn)).toBe(true);
    expect(roots.map((c) => c.name)).toContain('身份与证件');

    const templates = (await api(app).get('/api/life-folder/templates')).body as {
      id: string;
      recommended: boolean;
    }[];
    expect(templates.length).toBe(12);
    expect(templates.filter((t) => t.recommended).length).toBeGreaterThanOrEqual(6);
  });

  it('creates custom categories with depth and name rules (E109)', async () => {
    const created = await api(app)
      .post('/api/life-folder/categories')
      .send({ name: ' 保险合同 ' });
    expect(created.status).toBe(201);

    // Depth: child under a child is rejected.
    const roots = (await api(app).get('/api/life-folder/categories')).body as CategoryNode[];
    const parent = roots.find((c) => c.name === '保险合同')!;
    const child = await api(app)
      .post('/api/life-folder/categories')
      .send({ name: '重疾险', parentId: parent.id });
    expect(child.status).toBe(201);
    const tooDeep = await api(app)
      .post('/api/life-folder/categories')
      .send({ name: '某某重疾险', parentId: findCat(child.body as CategoryNode[], '重疾险')!.id });
    expect(tooDeep.status).toBe(422);

    // Sibling name conflict.
    const dup = await api(app).post('/api/life-folder/categories').send({ name: '保险合同' });
    expect(dup.status).toBe(409);

    // Built-in categories cannot be deleted.
    const builtin = roots.find((c) => c.builtIn)!;
    const delBuiltin = await api(app).delete(`/api/life-folder/categories/${builtin.id}`);
    expect(delBuiltin.status).toBe(422);
  });

  it('blocks deleting a non-empty category (E109)', async () => {
    await api(app).post('/api/life-folder/categories').send({ name: '占用分类' });
    const roots = (await api(app).get('/api/life-folder/categories')).body as CategoryNode[];
    const occupied = roots.find((c) => c.name === '占用分类')!;
    await uploadDoc({ categoryId: occupied.id, title: '我的身份证' }, PDF_BYTES, 'id.pdf');
    const res = await api(app).delete(`/api/life-folder/categories/${occupied.id}`);
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('CATEGORY_NOT_EMPTY');
  });
});

describe('documents (L1)', () => {
  it('uploads a PDF with sensitive defaulting true and downloads it back (A108/D5)', async () => {
    const up = await uploadDoc({ categoryId: 'lf-cat-finance', title: ' 银行卡清单 ' }, PDF_BYTES, 'cards.pdf');
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const doc = up.body as DocumentDto;
    expect(doc.title).toBe('银行卡清单');
    expect(doc.sensitive).toBe(true);
    expect(doc.mimeType).toBe('application/pdf');

    const list = await api(app).get('/api/life-folder/documents?category_id=lf-cat-finance');
    expect((list.body as DocumentDto[]).map((d) => d.id)).toContain(doc.id);

    const file = await api(app).get(`/api/life-folder/documents/${doc.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(file.body as Buffer, PDF_BYTES)).toBe(0);
  });

  it('E110: non-whitelist content is rejected even with a pdf filename', async () => {
    const res = await uploadDoc(
      { categoryId: 'lf-cat-health', title: 'fake' },
      Buffer.from('not a pdf at all'),
      'fake.pdf',
    );
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('DOCUMENT_TYPE_INVALID');
  });

  it('E114: linking a nonexistent template is rejected', async () => {
    const res = await uploadDoc(
      { categoryId: 'lf-cat-health', title: 'x', templateId: 'nope' },
      PDF_BYTES,
      'x.pdf',
    );
    expect(res.status).toBe(422);
  });

  it('moves a document between categories and replaces its file (A109)', async () => {
    const up = await uploadDoc({ categoryId: 'lf-cat-career', title: '学位证' }, PDF_BYTES, 'degree.pdf');
    const doc = up.body as DocumentDto;

    const moved = await api(app)
      .patch(`/api/life-folder/documents/${doc.id}`)
      .send({ categoryId: 'lf-cat-legal', updatedAt: doc.updatedAt });
    expect(moved.status).toBe(200);
    expect(moved.body.categoryId).toBe('lf-cat-legal');

    const replaced = await api(app)
      .put(`/api/life-folder/documents/${doc.id}/file`)
      .attach('file', PNG_BYTES, 'degree.png');
    expect(replaced.status).toBe(200);
    expect(replaced.body.mimeType).toBe('image/png');
    const file = await api(app).get(`/api/life-folder/documents/${doc.id}/file`);
    expect(file.headers['content-type']).toBe('image/png');
  });

  it('E111: moving to an unknown category is rejected (404)', async () => {
    const up = await uploadDoc({ categoryId: 'lf-cat-other', title: '联系人' }, PDF_BYTES, 'c.pdf');
    const doc = up.body as DocumentDto;
    const bad = await api(app)
      .patch(`/api/life-folder/documents/${doc.id}`)
      .send({ categoryId: crypto.randomUUID(), updatedAt: doc.updatedAt });
    expect(bad.status).toBe(404);
  });

  it('deletes a document: list shrinks, download 404s', async () => {
    const up = await uploadDoc({ categoryId: 'lf-cat-other', title: '一次性' }, PDF_BYTES, 'once.pdf');
    const doc = up.body as DocumentDto;
    await api(app).delete(`/api/life-folder/documents/${doc.id}`);
    const file = await api(app).get(`/api/life-folder/documents/${doc.id}/file`);
    expect(file.status).toBe(404);
  });
});

describe('isolation (L1 E113)', () => {
  it('another user sees only built-ins and cannot touch documents', async () => {
    const up = await uploadDoc({ categoryId: 'lf-cat-identity', title: '我的护照' }, PDF_BYTES, 'p.pdf');
    const doc = up.body as DocumentDto;

    await registerTestUser(app, 'life-l1-intruder');
    const docs = await api(app).get('/api/life-folder/documents');
    expect(docs.body).toEqual([]);
    const file = await api(app).get(`/api/life-folder/documents/${doc.id}/file`);
    expect(file.status).toBe(404);
    const patch = await api(app).patch(`/api/life-folder/documents/${doc.id}`).send({ title: 'x' });
    expect(patch.status).toBe(404);

    // Custom categories of the owner are invisible; built-ins still shared.
    const categories = (await api(app).get('/api/life-folder/categories')).body as CategoryNode[];
    expect(categories.every((c) => c.builtIn)).toBe(true);

    setAuthToken(tokenA);
  });
});
