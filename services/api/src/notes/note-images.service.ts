import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NoteImage } from '@prisma/client';
import type { NoteImageDto, MemoImageMime } from '@chpli2/shared';
import { ERROR_CODES, MEMO_IMAGE_MAX_BYTES } from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import {
  notFoundException,
  storageUnavailable,
  unprocessableException,
} from '../shared/http-error';
import { ObjectStorageService } from '../shared/object-storage.service';
import { sniffImageMime } from '../memo/images.service';

export interface NoteUploadFile {
  buffer: Buffer;
  originalName: string;
  size: number;
}

const EXTENSIONS: Record<MemoImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_FILE_NAME = 256;

function storageKeyFor(userId: string, noteId: string, imageId: string, ext: string): string {
  return `note-images/${userId}/${noteId}/${imageId}.${ext}`;
}

/**
 * Note attachments (N2 D6) — same semantics as memo images (M3): file bodies
 * in object storage, metadata + storage key in the DB, magic-byte sniffing,
 * idempotent client ids, authenticated proxy download.
 */
@Injectable()
export class NoteImagesService {
  private readonly logger = new Logger(NoteImagesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async list(userId: string, noteId: string): Promise<NoteImageDto[]> {
    await this.requireNote(userId, noteId);
    const rows = await this.prisma.noteImage.findMany({
      where: { noteId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async upload(userId: string, noteId: string, imageId: string, file: NoteUploadFile): Promise<NoteImageDto> {
    await this.requireNote(userId, noteId);

    const existing = await this.prisma.noteImage.findUnique({ where: { id: imageId } });
    if (existing) return this.toDto(existing);

    if (file.size > MEMO_IMAGE_MAX_BYTES || file.buffer.length > MEMO_IMAGE_MAX_BYTES) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `image exceeds the ${MEMO_IMAGE_MAX_BYTES}-byte limit (E85)`,
      );
    }
    const mime = sniffImageMime(file.buffer);
    if (!mime) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'file must be a JPEG, PNG, WebP or GIF image (E85)',
      );
    }

    const key = storageKeyFor(userId, noteId, imageId, EXTENSIONS[mime]);
    try {
      await this.storage.put(key, file.buffer, mime);
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }

    const row = await this.prisma.noteImage.create({
      data: {
        id: imageId,
        noteId,
        storageKey: key,
        fileName: file.originalName.slice(0, MAX_FILE_NAME) || `${imageId}.${EXTENSIONS[mime]}`,
        mimeType: mime,
        sizeBytes: file.size,
      },
    });
    return this.toDto(row);
  }

  async remove(userId: string, noteId: string, imageId: string): Promise<void> {
    const image = await this.requireImage(userId, noteId, imageId);
    await this.prisma.noteImage.delete({ where: { id: imageId } });
    try {
      await this.storage.remove(image.storageKey);
    } catch (error) {
      this.logger.warn(
        `failed to remove object ${image.storageKey} for deleted note image ${imageId}: ${(error as Error).message}`,
      );
    }
  }

  async file(userId: string, imageId: string): Promise<{
    stream: NodeJS.ReadableStream;
    size: number;
    mimeType: string;
    fileName: string;
  }> {
    const image = await this.prisma.noteImage.findFirst({
      where: { id: imageId, note: { userId, deletedAt: null } },
    });
    if (!image) {
      throw notFoundException(ERROR_CODES.NOTE_NOT_FOUND, 'image not found');
    }
    try {
      const stored = await this.storage.get(image.storageKey);
      return { ...stored, fileName: image.fileName };
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
  }

  private async requireNote(userId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!note) {
      throw notFoundException(ERROR_CODES.NOTE_NOT_FOUND, 'note not found');
    }
    return note;
  }

  private async requireImage(userId: string, noteId: string, imageId: string): Promise<NoteImage> {
    await this.requireNote(userId, noteId);
    const image = await this.prisma.noteImage.findFirst({ where: { id: imageId, noteId } });
    if (!image) {
      throw notFoundException(ERROR_CODES.NOTE_NOT_FOUND, 'image not found');
    }
    return image;
  }

  toDto(row: NoteImage): NoteImageDto {
    return {
      id: row.id,
      noteId: row.noteId,
      fileName: row.fileName,
      mimeType: row.mimeType as NoteImageDto['mimeType'],
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
