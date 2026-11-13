import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Bookmark } from '@prisma/client';
import type { BookmarkDto, BookmarkSort, CreateBookmarkDto, UpdateBookmarkDto } from '@chpli2/shared';
import {
  BOOKMARK_CATEGORY_MAX_LENGTH,
  BOOKMARK_CATEGORIES_MAX_COUNT,
  BOOKMARK_DESCRIPTION_MAX_LENGTH,
  BOOKMARK_INACTIVE_DAYS,
  BOOKMARK_SORTS,
  BOOKMARK_TITLE_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
  ERROR_CODES,
  isValidHttpUrl,
} from '@chpli2/shared';
import { PrismaService } from '../shared/prisma.service';
import { ObjectStorageService } from '../shared/object-storage.service';
import {
  conflictException,
  notFoundException,
  storageUnavailable,
  unprocessableException,
} from '../shared/http-error';
import { sniffImageMime } from '../memo/images.service';

const DAY_MS = 86_400_000;

/** Cover object key layout (B1 D2): one cover per bookmark. */
export function coverKeyFor(userId: string, bookmarkId: string, ext: string): string {
  return `bookmark-covers/${userId}/${bookmarkId}.${ext}`;
}

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  /** Lists the user's bookmarks in the requested order (B1 D6). */
  async list(userId: string, sort: BookmarkSort = 'recent'): Promise<BookmarkDto[]> {
    const orderBy =
      sort === 'clicks'
        ? [{ clickCount: 'desc' as const }, { createdAt: 'desc' as const }]
        : sort === 'title'
          ? [{ title: 'asc' as const }]
          : sort === 'added'
            ? [{ createdAt: 'desc' as const }]
            : // recent: lastClickedAt desc with unclicked last, then newest first
              [{ lastClickedAt: { sort: 'desc' as const, nulls: 'last' as const } }, { createdAt: 'desc' as const }];
    const rows = await this.prisma.bookmark.findMany({
      where: { userId, deletedAt: null },
      orderBy,
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Idempotent create on the client-generated id (E93). */
  async create(userId: string, body: CreateBookmarkDto): Promise<BookmarkDto> {
    const existing = await this.prisma.bookmark.findUnique({ where: { id: body.id } });
    if (existing) return this.toDto(existing);

    const bookmark = await this.prisma.bookmark.create({
      data: {
        id: body.id,
        userId,
        title: this.normalizeTitle(body.title),
        ...this.normalizeUrl(body.url),
        description: this.normalizeDescription(body.description ?? null),
        categories: this.normalizeCategories(body.categories ?? []),
      },
    });
    return this.toDto(bookmark);
  }

  async get(userId: string, id: string): Promise<BookmarkDto> {
    return this.toDto(await this.requireBookmark(userId, id));
  }

  async update(userId: string, id: string, body: UpdateBookmarkDto): Promise<BookmarkDto> {
    const bookmark = await this.requireBookmark(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'updatedAt must be a valid ISO 8601 datetime',
        );
      }
      if (clientVersion.getTime() !== bookmark.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the bookmark was modified elsewhere; reload before saving',
        );
      }
    }
    const url = body.url !== undefined ? this.normalizeUrl(body.url) : null;
    const updated = await this.prisma.bookmark.update({
      where: { id },
      data: {
        title: body.title !== undefined ? this.normalizeTitle(body.title) : bookmark.title,
        ...(url ?? { url: bookmark.url, domain: bookmark.domain }),
        description:
          body.description !== undefined
            ? this.normalizeDescription(body.description)
            : bookmark.description,
        categories:
          body.categories !== undefined ? this.normalizeCategories(body.categories) : bookmark.categories,
      },
    });
    return this.toDto(updated);
  }

  /** Soft-deletes and removes the cover object (best-effort, E95). */
  async remove(userId: string, id: string): Promise<void> {
    const bookmark = await this.requireBookmark(userId, id);
    await this.prisma.bookmark.update({ where: { id }, data: { deletedAt: new Date() } });
    if (bookmark.coverStorageKey) {
      try {
        await this.storage.remove(bookmark.coverStorageKey);
      } catch (error) {
        this.logger.warn(
          `failed to remove cover ${bookmark.coverStorageKey} for deleted bookmark ${id}: ${(error as Error).message}`,
        );
      }
    }
  }

  /** Records a click: count +1 and lastClickedAt=now (B1 D4). */
  async click(userId: string, id: string): Promise<BookmarkDto> {
    await this.requireBookmark(userId, id);
    const updated = await this.prisma.bookmark.update({
      where: { id },
      data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
    });
    return this.toDto(updated);
  }

  // -- Cover image (B1 D2, M3 semantics) ---------------------------------------

  async coverFile(userId: string, id: string): Promise<{
    stream: NodeJS.ReadableStream;
    size: number;
    mimeType: string;
    fileName: string;
  }> {
    const bookmark = await this.requireBookmark(userId, id);
    if (!bookmark.coverStorageKey) {
      throw notFoundException(ERROR_CODES.BOOKMARK_NOT_FOUND, 'cover not found');
    }
    try {
      const stored = await this.storage.get(bookmark.coverStorageKey);
      return { ...stored, fileName: bookmark.coverFileName ?? 'cover' };
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
  }

  /** Replaces the cover (removing the previous object best-effort). */
  async uploadCover(userId: string, id: string, file: {
    buffer: Buffer;
    originalName: string;
    size: number;
  }): Promise<BookmarkDto> {
    const bookmark = await this.requireBookmark(userId, id);
    const mime = sniffImageMime(file.buffer);
    if (!mime || file.size > 5 * 1024 * 1024 || file.buffer.length > 5 * 1024 * 1024) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'cover must be a JPEG, PNG, WebP or GIF image within 5MB (E91)',
      );
    }
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]!;
    const key = coverKeyFor(userId, id, ext);
    try {
      await this.storage.put(key, file.buffer, mime);
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
    if (bookmark.coverStorageKey && bookmark.coverStorageKey !== key) {
      try {
        await this.storage.remove(bookmark.coverStorageKey);
      } catch (error) {
        this.logger.warn(
          `failed to remove replaced cover ${bookmark.coverStorageKey} of bookmark ${id}: ${(error as Error).message}`,
        );
      }
    }
    const updated = await this.prisma.bookmark.update({
      where: { id },
      data: {
        coverStorageKey: key,
        coverFileName: file.originalName.slice(0, 256) || `cover.${ext}`,
        coverMimeType: mime,
      },
    });
    return this.toDto(updated);
  }

  // -- helpers -----------------------------------------------------------------

  private normalizeTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty (E90)');
    }
    if (trimmed.length > BOOKMARK_TITLE_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title exceeds 256 characters');
    }
    return trimmed;
  }

  private normalizeUrl(url: string): { url: string; domain: string } {
    const trimmed = url.trim();
    if (trimmed.length > BOOKMARK_URL_MAX_LENGTH) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `url exceeds the ${BOOKMARK_URL_MAX_LENGTH}-character limit (E89)`,
      );
    }
    if (!isValidHttpUrl(trimmed)) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'url must be a valid http(s) URL (E89)',
      );
    }
    return { url: trimmed, domain: new URL(trimmed).hostname };
  }

  private normalizeDescription(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > BOOKMARK_DESCRIPTION_MAX_LENGTH) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'description exceeds 2000 characters (E90)',
      );
    }
    return trimmed;
  }

  private normalizeCategories(value: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of value) {
      const tag = raw.trim();
      if (!tag) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'categories must not be empty (E90)');
      }
      if (tag.length > BOOKMARK_CATEGORY_MAX_LENGTH) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          `categories must be at most ${BOOKMARK_CATEGORY_MAX_LENGTH} characters (E90)`,
        );
      }
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    if (out.length > BOOKMARK_CATEGORIES_MAX_COUNT) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `at most ${BOOKMARK_CATEGORIES_MAX_COUNT} categories per bookmark (E90)`,
      );
    }
    return out;
  }

  private async requireBookmark(userId: string, id: string): Promise<Bookmark> {
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!bookmark) {
      throw notFoundException(ERROR_CODES.BOOKMARK_NOT_FOUND, 'bookmark not found');
    }
    return bookmark;
  }

  toDto(bookmark: Bookmark): BookmarkDto {
    const lastTouch = bookmark.lastClickedAt ?? bookmark.createdAt;
    return {
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      domain: bookmark.domain,
      description: bookmark.description,
      categories: bookmark.categories,
      hasCover: bookmark.coverStorageKey !== null,
      clickCount: bookmark.clickCount,
      lastClickedAt: bookmark.lastClickedAt ? bookmark.lastClickedAt.toISOString() : null,
      inactive: Date.now() - lastTouch.getTime() >= BOOKMARK_INACTIVE_DAYS * DAY_MS,
      createdAt: bookmark.createdAt.toISOString(),
      updatedAt: bookmark.updatedAt.toISOString(),
    };
  }
}
