import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n';
import MemoImages from '../components/MemoImages';
import type { MemoImageDto } from '@chpli2/shared';

const image: MemoImageDto = {
  id: 'img-1',
  memoId: 'm1',
  fileName: 'photo.png',
  mimeType: 'image/png',
  sizeBytes: 68,
  createdAt: '2026-11-12T00:00:00.000Z',
};

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-CN');
  // jsdom has no URL.createObjectURL; stub it for the blob thumbnails.
  let nextUrl = 0;
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: () => `blob:mock-${(nextUrl += 1)}`,
    revokeObjectURL: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(handlers: { onDelete?: () => void; onUpload?: () => void }) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/images') && !init?.method) return Promise.resolve(jsonResponse([image]));
    if (url.includes('/images') && init?.method === 'DELETE') {
      handlers.onDelete?.();
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.endsWith('/images') && init?.method === 'POST') {
      handlers.onUpload?.();
      return Promise.resolve(jsonResponse(image, 201));
    }
    if (url.includes('/file')) {
      return Promise.resolve(
        new Response(new Uint8Array(PNG_BYTES), { status: 200 }),
      );
    }
    return Promise.resolve(jsonResponse({}, 404));
  }));
}

describe('MemoImages (M3)', () => {
  it('lists images and renders thumbnails from the authenticated file endpoint', async () => {
    stubFetch({});
    const { container } = render(<MemoImages memoId="m1" />);
    await waitFor(() =>
      expect(container.querySelectorAll('.memo-images__item').length).toBe(1),
    );
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(/^blob:mock-/);
    expect(screen.getByRole('button', { name: '添加图片' })).toBeTruthy();
  });

  it('delete requires a second click (confirmation step, A18)', async () => {
    let deleted = false;
    stubFetch({ onDelete: () => (deleted = true) });
    render(<MemoImages memoId="m1" />);
    await waitFor(() => expect(screen.getByText('×')).toBeTruthy());
    fireEvent.click(screen.getByText('×'));
    expect(deleted).toBe(false);
    fireEvent.click(screen.getByText('确认?'));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('uploads the picked file and appends it to the grid', async () => {
    let uploaded = false;
    stubFetch({ onUpload: () => (uploaded = true) });
    const { container } = render(<MemoImages memoId="m1" />);
    await waitFor(() =>
      expect(container.querySelectorAll('.memo-images__item').length).toBe(1),
    );
    const file = new File([new Uint8Array(PNG_BYTES)], 'new.png', { type: 'image/png' });
    const input = container.querySelector('.memo-images__input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploaded).toBe(true));
  });
});
