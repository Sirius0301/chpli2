import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LifeCategory, LifeDocument, LifeTemplate } from '@prisma/client';
import type {
  CreateLifeCategoryDto,
  CreateLifeDocumentDto,
  LifeCategoryDto,
  LifeDocumentDto,
  LifeTemplateDto,
  UpdateLifeDocumentDto,
} from '@chpli2/shared';
import {
  CATEGORY_NAME_MAX_LENGTH,
  DOCUMENT_NOTES_MAX_LENGTH,
  DOCUMENT_TITLE_MAX_LENGTH,
  ERROR_CODES,
  LIFE_DOC_MAX_BYTES,
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

/** Magic-byte sniffing for the life-document whitelist (PDF + 4 image types). */
export function sniffLifeDocMime(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  return sniffImageMime(buffer);
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function lifeDocKeyFor(userId: string, documentId: string, ext: string): string {
  return `life-files/${userId}/${documentId}.${ext}`;
}

@Injectable()
export class LifeFolderService {
  private readonly logger = new Logger(LifeFolderService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  // -- Categories ------------------------------------------------------------------

  /** Built-in + custom categories as a two-level tree (L1 D1). */
  async categories(userId: string): Promise<LifeCategoryDto[]> {
    const rows = await this.prisma.lifeCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const nodes = new Map<string, LifeCategoryDto>(
      rows.map((row) => [row.id, this.toCategoryNode(row)]),
    );
    const roots: LifeCategoryDto[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async createCategory(userId: string, body: CreateLifeCategoryDto): Promise<LifeCategoryDto> {
    const name = this.normalizeCategoryName(body.name);
    let parent: LifeCategory | null = null;
    if (body.parentId) {
      parent = await this.requireCategory(userId, body.parentId);
      if (parent.parentId) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'category depth is limited to two levels (E109)',
        );
      }
    }
    // Sibling-name uniqueness enforced in the service (NULL parentId defeats
    // a plain composite unique index).
    const sibling = await this.prisma.lifeCategory.findFirst({
      where: {
        OR: [{ userId }, { userId: null }],
        name,
        parentId: body.parentId ?? null,
      },
    });
    if (sibling) {
      throw conflictException(
        ERROR_CODES.VALIDATION_ERROR,
        'a sibling category with this name already exists (E109)',
      );
    }
    await this.prisma.lifeCategory.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        name,
        parentId: body.parentId ?? null,
        sortOrder: 100,
      },
    });
    return (await this.categories(userId)).find(
      (node) => node.name === name && node.parentId === (body.parentId ?? null),
    )!;
  }

  async removeCategory(userId: string, id: string): Promise<void> {
    const category = await this.requireCategory(userId, id);
    if (category.userId === null) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        'built-in categories cannot be deleted (E109)',
      );
    }
    const documents = await this.prisma.lifeDocument.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (documents > 0) {
      throw unprocessableException(
        ERROR_CODES.CATEGORY_NOT_EMPTY,
        'move or delete the documents in this category first (E109)',
      );
    }
    await this.prisma.lifeCategory.delete({ where: { id } });
  }

  // -- Templates ---------------------------------------------------------------------

  async templates(): Promise<LifeTemplateDto[]> {
    const rows = await this.prisma.lifeTemplate.findMany({
      orderBy: [{ recommended: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toTemplateDto(row));
  }

  // -- Documents -----------------------------------------------------------------------

  async documents(userId: string, categoryId?: string): Promise<LifeDocumentDto[]> {
    if (categoryId) await this.requireCategory(userId, categoryId);
    const rows = await this.prisma.lifeDocument.findMany({
      where: { userId, deletedAt: null, ...(categoryId ? { categoryId } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toDocumentDto(row));
  }

  /** Idempotent create with the file body going straight to object storage. */
  async createDocument(
    userId: string,
    fields: CreateLifeDocumentDto,
    file: { buffer: Buffer; originalName: string; size: number },
  ): Promise<LifeDocumentDto> {
    const existing = await this.prisma.lifeDocument.findUnique({ where: { id: fields.id } });
    if (existing) return this.toDocumentDto(existing);

    const category = await this.requireCategory(userId, fields.categoryId);
    void category;
    const title = this.normalizeTitle(fields.title);
    const notes = this.normalizeNotes(fields.notes ?? null);
    const sensitive = fields.sensitive ?? true; // private by default (D5)
    if (fields.templateId) {
      const template = await this.prisma.lifeTemplate.findUnique({ where: { id: fields.templateId } });
      if (!template) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'templateId does not exist (E114)');
      }
    }
    const mime = this.validateFile(file);

    const key = lifeDocKeyFor(userId, fields.id, EXTENSIONS[mime]!);
    try {
      await this.storage.put(key, file.buffer, mime);
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
    const row = await this.prisma.lifeDocument.create({
      data: {
        id: fields.id,
        userId,
        categoryId: fields.categoryId,
        title,
        notes,
        sensitive,
        templateId: fields.templateId ?? null,
        storageKey: key,
        fileName: file.originalName.slice(0, 256) || `document.${EXTENSIONS[mime]}`,
        mimeType: mime,
        sizeBytes: file.size,
      },
    });
    return this.toDocumentDto(row);
  }

  async updateDocument(
    userId: string,
    id: string,
    body: UpdateLifeDocumentDto,
  ): Promise<LifeDocumentDto> {
    const document = await this.requireDocument(userId, id);
    if (body.updatedAt !== undefined) {
      const clientVersion = new Date(body.updatedAt);
      if (Number.isNaN(clientVersion.getTime())) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'updatedAt must be a valid ISO 8601 datetime');
      }
      if (clientVersion.getTime() !== document.updatedAt.getTime()) {
        throw conflictException(
          ERROR_CODES.CONCURRENT_MODIFICATION,
          'the document was modified elsewhere; reload before saving',
        );
      }
    }
    if (body.categoryId && body.categoryId !== document.categoryId) {
      await this.requireCategory(userId, body.categoryId); // 404 (E111)
    }
    const updated = await this.prisma.lifeDocument.update({
      where: { id },
      data: {
        title: body.title !== undefined ? this.normalizeTitle(body.title) : document.title,
        notes: body.notes !== undefined ? this.normalizeNotes(body.notes) : document.notes,
        sensitive: body.sensitive ?? document.sensitive,
        categoryId: body.categoryId ?? document.categoryId,
      },
    });
    return this.toDocumentDto(updated);
  }

  /** Soft-deletes the record and removes the object best-effort (M3 D5). */
  async removeDocument(userId: string, id: string): Promise<void> {
    const document = await this.requireDocument(userId, id);
    await this.prisma.lifeDocument.update({ where: { id }, data: { deletedAt: new Date() } });
    try {
      await this.storage.remove(document.storageKey);
    } catch (error) {
      this.logger.warn(
        `failed to remove object ${document.storageKey} for deleted document ${id}: ${(error as Error).message}`,
      );
    }
  }

  /** Replaces the file body (old object removed best-effort). */
  async replaceFile(
    userId: string,
    id: string,
    file: { buffer: Buffer; originalName: string; size: number },
  ): Promise<LifeDocumentDto> {
    const document = await this.requireDocument(userId, id);
    const mime = this.validateFile(file);
    const key = lifeDocKeyFor(userId, id, EXTENSIONS[mime]!);
    try {
      await this.storage.put(key, file.buffer, mime);
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
    if (document.storageKey !== key) {
      try {
        await this.storage.remove(document.storageKey);
      } catch (error) {
        this.logger.warn(
          `failed to remove replaced object ${document.storageKey} of document ${id}: ${(error as Error).message}`,
        );
      }
    }
    const updated = await this.prisma.lifeDocument.update({
      where: { id },
      data: {
        storageKey: key,
        fileName: file.originalName.slice(0, 256) || `document.${EXTENSIONS[mime]}`,
        mimeType: mime,
        sizeBytes: file.size,
      },
    });
    return this.toDocumentDto(updated);
  }

  async file(userId: string, id: string): Promise<{
    stream: NodeJS.ReadableStream;
    size: number;
    mimeType: string;
    fileName: string;
  }> {
    const document = await this.requireDocument(userId, id);
    try {
      const stored = await this.storage.get(document.storageKey);
      return { ...stored, fileName: document.fileName };
    } catch (error) {
      throw storageUnavailable((error as Error).message);
    }
  }

  // -- helpers ---------------------------------------------------------------------------

  private validateFile(file: { buffer: Buffer; size: number }): string {
    if (file.size > LIFE_DOC_MAX_BYTES || file.buffer.length > LIFE_DOC_MAX_BYTES) {
      throw unprocessableException(
        ERROR_CODES.VALIDATION_ERROR,
        `file exceeds the ${LIFE_DOC_MAX_BYTES}-byte limit (E110)`,
      );
    }
    const mime = sniffLifeDocMime(file.buffer);
    if (!mime) {
      throw unprocessableException(
        ERROR_CODES.DOCUMENT_TYPE_INVALID,
        'file must be a PDF or a JPEG/PNG/WebP/GIF image (E110)',
      );
    }
    return mime;
  }

  private normalizeCategoryName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'category name must not be empty');
    }
    if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'category name exceeds 64 characters');
    }
    return trimmed;
  }

  private normalizeTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title must not be empty');
    }
    if (trimmed.length > DOCUMENT_TITLE_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'title exceeds 256 characters');
    }
    return trimmed;
  }

  private normalizeNotes(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > DOCUMENT_NOTES_MAX_LENGTH) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'notes exceed 2000 characters');
    }
    return trimmed;
  }

  private async requireCategory(userId: string, id: string): Promise<LifeCategory> {
    const category = await this.prisma.lifeCategory.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!category) {
      throw notFoundException(ERROR_CODES.CATEGORY_NOT_FOUND, 'category not found');
    }
    return category;
  }

  private async requireDocument(userId: string, id: string): Promise<LifeDocument> {
    const document = await this.prisma.lifeDocument.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!document) {
      throw notFoundException(ERROR_CODES.DOCUMENT_NOT_FOUND, 'document not found');
    }
    return document;
  }

  private toCategoryNode(row: LifeCategory): LifeCategoryDto {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      builtIn: row.userId === null,
      children: [],
    };
  }

  private toTemplateDto(row: LifeTemplate): LifeTemplateDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
      recommended: row.recommended,
    };
  }

  private toDocumentDto(row: LifeDocument): LifeDocumentDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      title: row.title,
      notes: row.notes,
      sensitive: row.sensitive,
      templateId: row.templateId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
