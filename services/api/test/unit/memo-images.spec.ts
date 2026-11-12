import { describe, expect, it } from 'vitest';
import { sniffImageMime, storageKeyFor } from '../../src/memo/images.service';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(16)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(8),
]);

describe('sniffImageMime (M3 E59)', () => {
  it('recognizes jpeg, png, gif and webp by magic bytes', () => {
    expect(sniffImageMime(PNG)).toBe('image/png');
    expect(sniffImageMime(JPEG)).toBe('image/jpeg');
    expect(sniffImageMime(GIF)).toBe('image/gif');
    expect(sniffImageMime(WEBP)).toBe('image/webp');
  });

  it('rejects plain text and truncated buffers', () => {
    expect(sniffImageMime(Buffer.from('not an image at all'))).toBeNull();
    expect(sniffImageMime(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('storageKeyFor (M3 D2)', () => {
  it('builds the user-scoped storage key', () => {
    expect(storageKeyFor('u1', 'm1', 'i1', 'png')).toBe('memo-images/u1/m1/i1.png');
  });
});
