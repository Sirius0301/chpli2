import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { Readable } from 'node:stream';
import type {
  NoteDto,
  NoteHomeCardDto,
  NoteImageDto,
  NotePriority,
  NotePublishStatus,
  NoteSummaryDto,
  NoteVersionDto,
  TagCountDto,
} from '@chpli2/shared';
import {
  ERROR_CODES,
  MEMO_IMAGE_MAX_BYTES,
  MEMO_PRIORITIES,
  NOTE_CATEGORY_MAX_LENGTH,
  NOTE_PUBLISH_STATUSES,
} from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { unprocessableException } from '../shared/http-error';
import { NotesService, type NoteFilters } from './notes.service';
import { NoteImagesService } from './note-images.service';
import {
  CreateNoteBody,
  NoteDtoSchema,
  NoteImageDtoSchema,
  NoteHomeCardDtoSchema,
  NoteSummaryDtoSchema,
  NoteVersionDtoSchema,
  TagCountDtoSchema,
  UpdateNoteBody,
} from './notes.dto';

export class ListNotesQuery {
  @ApiPropertyOptional({ type: 'string', example: 'work,ideas', description: 'Comma-separated tags, AND semantics' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ type: 'string', example: 'high,medium', description: 'Comma-separated priorities, OR semantics' })
  @IsOptional()
  @IsString()
  priorities?: string;

  @ApiPropertyOptional({ type: 'string', example: 'tech,life', description: 'Comma-separated categories, OR semantics (N3)' })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiPropertyOptional({ type: 'string', example: 'draft,published', description: 'Comma-separated publish statuses, OR semantics (N3)' })
  @IsOptional()
  @IsString()
  publishStatuses?: string;

  @ApiPropertyOptional({ type: 'string', example: 'meeting', description: 'Full-text search across title/body/tags (N2 D3)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  q?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Inclusive creation window start (ISO 8601, used by the Memo day view)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  createdFrom?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Exclusive creation window end (ISO 8601, used by the Memo day view)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  createdTo?: string;
}

export class UploadNoteImageBody {
  @ApiPropertyOptional({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent upload, E85)' })
  @IsString()
  id!: string;
}

function splitList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function parseFilters(query: ListNotesQuery): NoteFilters {
  const filters: NoteFilters = { q: query.q };
  const tags = splitList(query.tags);
  if (tags) {
    for (const tag of tags) {
      if (tag.length > 32) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'each tag must be at most 32 characters (E77)');
      }
    }
    filters.tags = tags;
  }
  const priorities = splitList(query.priorities);
  if (priorities) {
    for (const p of priorities) {
      if (!(MEMO_PRIORITIES as readonly string[]).includes(p)) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'priorities must be valid priority values (E77)');
      }
    }
    filters.priorities = priorities as NotePriority[];
  }
  const categories = splitList(query.categories);
  if (categories) {
    for (const c of categories) {
      if (c.length > NOTE_CATEGORY_MAX_LENGTH) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'each category must be at most 32 characters');
      }
    }
    filters.categories = categories;
  }
  const statuses = splitList(query.publishStatuses);
  if (statuses) {
    for (const st of statuses) {
      if (!(NOTE_PUBLISH_STATUSES as readonly string[]).includes(st)) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'publishStatuses must be valid status values');
      }
    }
    filters.publishStatuses = statuses as NotePublishStatus[];
  }
  if (query.createdFrom) filters.createdFrom = new Date(query.createdFrom);
  if (query.createdTo) filters.createdTo = new Date(query.createdTo);
  if (filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo) {
    throw unprocessableException(
      ERROR_CODES.VALIDATION_ERROR,
      'createdFrom must not be after createdTo',
    );
  }
  return filters;
}

@ApiTags('notes')
@Controller('notes')
export class NotesController {
  constructor(
    @Inject(NotesService) private readonly notesService: NotesService,
    @Inject(NoteImagesService) private readonly noteImagesService: NoteImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the user's notes, most recently updated first" })
  @ApiOkResponse({ type: [NoteDtoSchema] })
  listNotes(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(ListNotesQuery) query: ListNotesQuery,
  ): Promise<NoteDto[]> {
    return this.notesService.list(user.userId, parseFilters(query));
  }

  @Get('tags')
  @ApiOperation({ summary: 'Tag aggregate across all of the user\'s notes (filter sidebar candidates)' })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  listTags(@CurrentUser() user: AuthPrincipal): Promise<TagCountDto[]> {
    return this.notesService.tagCounts(user.userId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Category aggregate across all of the user\'s notes (filter sidebar candidates, N3)' })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  listCategories(@CurrentUser() user: AuthPrincipal): Promise<TagCountDto[]> {
    return this.notesService.categoryCounts(user.userId);
  }

  @Get('home')
  @ApiOperation({ summary: 'Home-page cards: published notes flagged showOnHome (N3 首页展示)' })
  @ApiOkResponse({ type: [NoteHomeCardDtoSchema] })
  homeCards(@CurrentUser() user: AuthPrincipal): Promise<NoteHomeCardDto[]> {
    return this.notesService.homeCards(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a note (idempotent on the client-generated id, E79)' })
  @ApiCreatedResponse({ type: NoteDtoSchema })
  createNote(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateNoteBody) body: CreateNoteBody,
  ): Promise<NoteDto> {
    return this.notesService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single note' })
  @ApiOkResponse({ type: NoteDtoSchema })
  getNote(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<NoteDto> {
    return this.notesService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note (optimistic lock via updatedAt, E78)' })
  @ApiOkResponse({ type: NoteDtoSchema })
  updateNote(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateNoteBody) body: UpdateNoteBody,
  ): Promise<NoteDto> {
    return this.notesService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a note (soft delete)' })
  @ApiNoContentResponse({ description: 'Note deleted' })
  async deleteNote(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.notesService.remove(user.userId, id);
  }

  // -- Backlinks & versions (N2) ------------------------------------------------

  @Get(':id/backlinks')
  @ApiOperation({ summary: 'Notes linking to this note via [[id]] (N2 D2)' })
  @ApiOkResponse({ type: [NoteSummaryDtoSchema] })
  backlinks(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<NoteSummaryDto[]> {
    return this.notesService.backlinks(user.userId, id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Version history, newest first (N2 D4)' })
  @ApiOkResponse({ type: [NoteVersionDtoSchema] })
  versions(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<NoteVersionDto[]> {
    return this.notesService.versions(user.userId, id);
  }

  @Post(':id/versions/:seq/restore')
  @ApiOperation({
    summary: 'Restore a version as a NEW revision; history is never rewritten (N2 D5)',
  })
  @ApiCreatedResponse({ type: NoteDtoSchema })
  restoreVersion(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Param('seq') seq: string,
  ): Promise<NoteDto> {
    const parsed = Number.parseInt(seq, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'seq must be a positive integer (E83)');
    }
    return this.notesService.restoreVersion(user.userId, id, parsed);
  }

  // -- Images (N2 D6): same semantics as memo images (M3) -----------------------

  @Get(':id/images')
  @ApiOperation({ summary: "List a note's images (metadata only)" })
  @ApiOkResponse({ type: [NoteImageDtoSchema] })
  listImages(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') noteId: string,
  ): Promise<NoteImageDto[]> {
    return this.noteImagesService.list(user.userId, noteId);
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one image (multipart: file + client id; idempotent, E85)' })
  @ApiCreatedResponse({ type: NoteImageDtoSchema })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MEMO_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  uploadImage(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') noteId: string,
    @ValidatedBody(UploadNoteImageBody) body: UploadNoteImageBody,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<NoteImageDto> {
    if (!file) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'file is required');
    }
    return this.noteImagesService.upload(user.userId, noteId, body.id, {
      buffer: file.buffer,
      originalName: file.originalname,
      size: file.size,
    });
  }

  @Delete(':id/images/:imageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a note image (metadata first; object failure still succeeds)' })
  @ApiNoContentResponse({ description: 'Image deleted' })
  async deleteImage(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') noteId: string,
    @Param('imageId') imageId: string,
  ): Promise<void> {
    await this.noteImagesService.remove(user.userId, noteId, imageId);
  }

  @Get('images/:imageId/file')
  @ApiOperation({ summary: 'Download a note image through the authenticated API' })
  async imageFile(
    @CurrentUser() user: AuthPrincipal,
    @Param('imageId') imageId: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.noteImagesService.file(user.userId, imageId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    (file.stream as unknown as Readable).pipe(res);
  }
}
