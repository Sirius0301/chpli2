import { Inject, Injectable, Logger } from '@nestjs/common';
import type { MemoImage } from '@prisma/client';
import type { MemoImageDto, MemoImageMime } from '@chpli2/shared';
import { ERROR_CODES, MEMO_IMAGE_MAX_BYTES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { notFoundException, storageUnavailable, unprocessableException } from '../shared/http-error';
import { ObjectStorageService } from './storage.service';

export interface UploadFile {
  buffer: Buffer;
  originalName: string;
  declaredMime: string;
  size: number;
}

export interface ImageFileStream {
  stream: NodeJS.ReadableStream;
  size: number;
  mimeType: string;
  fileName: string;
}

/** Sniffs the real image type from magic bytes (E59); never trusts the
 * client-supplied mime or filename. Returns null for unknown content. */
export function sniffImageMime(buffer: Buffer): MemoImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const EXTENSIONS: Record<MemoImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Storage key layout (M3 D2): user-scoped prefix for bulk lifecycle ops. */
export function storageKeyFor(userId: string, memoId: string, imageId: string, ext: string): string {
  return `memo-images/${userId}/${memoId}/${imageId}.${ext}`;
}

const MAX_FILE_NAME = 256;

@Injectable()
export class MemoImagesService {
  private readonly logger = new Logger(MemoImagesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  /** Lists the memo's images (metadata only), oldest first. */
  async list(userId: string, memoId: string): Promise<MemoImageDto[]> {
    await this.requireMemo(userId, memoId);
    const rows = await this.prisma.memoImage.findMany({
      where: { memoId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Uploads one image: validates size + magic bytes, stores the body in
   * object storage and persists metadata + storage key. Idempotent on the
   * client-generated image id (E58): a repeated submission returns the
   * original record without re-uploading.
   */
  async upload(
    userId: string,
    memoId: string,
    imageId: string,
    file: UploadFile,
  ): Promise<MemoImageDto> {
    await this.requireMemo(userId, memoId);

    const existing = await this.prisma.memoImage.findUnique({ where: { id: imageId } });
    if (existing) return this.toDto(existing);

    if (file.size > MEMO_IMAGE_MAX_BYTES || file.buffer.length > MEMO_IMAGE_MAX_BYTES) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `image exceeds the ${MEMO_IMAGE_MAX_BYTES}-byte limit (E60)`,
      );
    }
    const mime = sniffImageMime(file.buffer);
    if (!mime) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'file must be a JPEG, PNG, WebP or GIF image (E59)',
      );
    }

    const key = storageKeyFor(userId, memoId, imageId, EXTENSIONS[mime]);
    try {
      await this.storage.put(key, file.buffer, mime);
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }

    const row = await this.prisma.memoImage.create({
      data: {
        id: imageId,
        memoId,
        storageKey: key,
        fileName: file.originalName.slice(0, MAX_FILE_NAME) || `${imageId}.${EXTENSIONS[mime]}`,
        mimeType: mime,
        sizeBytes: file.size,
      },
    });
    return this.toDto(row);
  }

  /**
   * Deletes the image metadata and then the object (M3 D5): a failing object
   * removal does not roll back the metadata deletion — the API still
   * succeeds and the stale object is logged for ops cleanup (E63).
   */
  async remove(userId: string, memoId: string, imageId: string): Promise<void> {
    const image = await this.requireImage(userId, memoId, imageId);
    await this.prisma.memoImage.delete({ where: { id: imageId } });
    try {
      await this.storage.remove(image.storageKey);
    } catch (error) {
      this.logger.warn(
        `failed to remove object ${image.storageKey} for deleted image ${imageId}: ${(error as Error).message}`,
      );
    }
  }

  /** Streams the image body back through the authenticated API (M3 D3). */
  async file(userId: string, imageId: string): Promise<ImageFileStream> {
    const image = await this.prisma.memoImage.findFirst({
      where: { id: imageId, memo: { userId, deletedAt: null } },
    });
    if (!image) {
      throw notFoundException(ERROR_CODES.MEMO_NOT_FOUND, 'image not found');
    }
    try {
      const stored = await this.storage.get(image.storageKey);
      return { ...stored, fileName: image.fileName };
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
  }

  private async requireMemo(userId: string, memoId: string) {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!memo) {
      throw notFoundException(ERROR_CODES.MEMO_NOT_FOUND, 'memo not found');
    }
    return memo;
  }

  private async requireImage(userId: string, memoId: string, imageId: string): Promise<MemoImage> {
    await this.requireMemo(userId, memoId);
    const image = await this.prisma.memoImage.findFirst({ where: { id: imageId, memoId } });
    if (!image) {
      throw notFoundException(ERROR_CODES.MEMO_NOT_FOUND, 'image not found');
    }
    return image;
  }

  toDto(row: MemoImage): MemoImageDto {
    return {
      id: row.id,
      memoId: row.memoId,
      fileName: row.fileName,
      mimeType: row.mimeType as MemoImageDto['mimeType'],
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
