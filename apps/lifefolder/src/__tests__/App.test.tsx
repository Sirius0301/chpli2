import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../i18n';
import App from '../App';
import type { LifeCategoryDto, LifeDocumentDto, LifeTemplateDto } from '@chpli2/shared';

function cat(partial: Partial<LifeCategoryDto> & Pick<LifeCategoryDto, 'id' | 'name'>): LifeCategoryDto {
  return { userId: null, parentId: null, sortOrder: 0, builtIn: true, children: [], ...partial };
}

function doc(partial: Partial<LifeDocumentDto> & Pick<LifeDocumentDto, 'id' | 'title'>): LifeDocumentDto {
  return {
    categoryId: 'lf-cat-identity',
    notes: null,
    sensitive: true,
    templateId: null,
    fileName: 'x.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    ...partial,
  };
}

function tpl(partial: Partial<LifeTemplateDto> & Pick<LifeTemplateDto, 'id' | 'name'>): LifeTemplateDto {
  return { categoryId: 'lf-cat-identity', description: 'd', recommended: false, ...partial };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface StubOptions {
  categories?: LifeCategoryDto[];
  templates?: LifeTemplateDto[];
  documents?: LifeDocumentDto[];
  onCreateCategory?: (body: Record<string, unknown>) => void;
}

function stubFetch(options: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/categories') && init?.method === 'POST') {
        options.onCreateCategory?.(JSON.parse(String(init.body)) as Record<string, unknown>);
        return Promise.resolve(jsonResponse(options.categories ?? [], 201));
      }
      if (url.includes('/life-folder/categories')) {
        return Promise.resolve(jsonResponse(options.categories ?? []));
      }
      if (url.includes('/life-folder/templates')) {
        return Promise.resolve(jsonResponse(options.templates ?? []));
      }
      if (url.includes('/life-folder/documents')) {
        return Promise.resolve(jsonResponse(options.documents ?? []));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }),
  );
}

beforeEach(async () => {
  try {
    globalThis.localStorage?.clear?.();
  } catch {
    /* storage unavailable */
  }
  await i18n.changeLanguage('zh-CN');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const BUILTIN: LifeCategoryDto[] = [
  cat({ id: 'lf-cat-identity', name: '身份与证件', sortOrder: 1 }),
  cat({ id: 'lf-cat-finance', name: '财务与税务', sortOrder: 2 }),
];

describe('Life Folder (L1)', () => {
  it('renders built-in categories and documents with the sensitive badge (A108)', async () => {
    stubFetch({
      categories: BUILTIN,
      documents: [doc({ id: 'd1', title: '我的身份证' })],
    });
    const { container } = render(<App />);
    const side = () => within(container.querySelector('.lf-side') as HTMLElement);
    await waitFor(() => expect(side().getByText('身份与证件')).toBeTruthy());
    const main = within(container.querySelector('.lf-main') as HTMLElement);
    expect(main.getByText('我的身份证')).toBeTruthy();
    expect(main.getByText('敏感')).toBeTruthy();
  });

  it('derives recommendations from unfulfilled recommended templates (A110)', async () => {
    stubFetch({
      categories: BUILTIN,
      templates: [
        tpl({ id: 't1', name: '身份证', recommended: true }),
        tpl({ id: 't2', name: '护照', recommended: true }),
        tpl({ id: 't3', name: '保险合同', recommended: false }),
      ],
      documents: [doc({ id: 'd1', title: '已有', templateId: 't1' })],
    });
    render(<App />);
    const recs = await screen.findByTestId('recommendations');
    expect(recs.textContent).toContain('护照');
    expect(recs.textContent).not.toContain('保险合同'); // not recommended
    expect(within(recs).getAllByRole('button', { name: '按模板添加' })).toHaveLength(1);
  });

  it('creates a custom category and shows the empty state for it', async () => {
    let created: Record<string, unknown> | undefined;
    stubFetch({
      categories: BUILTIN,
      onCreateCategory: (b) => (created = b),
    });
    const { container } = render(<App />);
    const side = () => within(container.querySelector('.lf-side') as HTMLElement);
    await waitFor(() => expect(side().getByText('身份与证件')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '新建分类' }));
    fireEvent.change(screen.getByPlaceholderText('分类名称'), { target: { value: '  自定义类 ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(created).toMatchObject({ name: '自定义类', parentId: null }));
  });

  it('deleting a category requires a second click (E112/A18)', async () => {
    let deleted = false;
    const custom = cat({ id: 'c9', name: '临时类', builtIn: false, userId: 'u1' });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/life-folder/categories') && init?.method === 'DELETE') {
          deleted = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url.includes('/life-folder/categories')) return Promise.resolve(jsonResponse([...BUILTIN, custom]));
        if (url.includes('/life-folder/templates')) return Promise.resolve(jsonResponse([]));
        if (url.includes('/life-folder/documents')) return Promise.resolve(jsonResponse([]));
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByText('临时类')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(deleted).toBe(false);
    fireEvent.click(await screen.findByRole('button', { name: '再次点击确认删除分类' }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
