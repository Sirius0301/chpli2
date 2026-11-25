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
  Put,
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
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Readable } from 'node:stream';
import type { MemoDto, MemoPriority, TagCountDto } from '@chpli2/shared';
import { ERROR_CODES, MEMO_IMAGE_MAX_BYTES, MEMO_PRIORITIES } from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { unprocessableException } from '../shared/http-error';
import { MemoService, type MemoFilters } from './memo.service';
import { MemoImagesService } from './images.service';
import {
  CreateMemoBody,
  MemoDtoSchema,
  MemoImageDtoSchema,
  RenameTagBody,
  SetMemoCompletionBody,
  TagCountDtoSchema,
  UpdateMemoBody,
} from './memo.dto';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class UploadImageBody {
  @ApiPropertyOptional({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent upload, E58)' })
  @IsUUID()
  id!: string;
}

export class ListMemosQuery {
  @ApiPropertyOptional({ type: 'string', example: '2026-11-01', description: 'YYYY-MM-DD (inclusive)' })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  from?: string;

  @ApiPropertyOptional({ type: 'string', example: '2026-12-01', description: 'YYYY-MM-DD (exclusive)' })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  to?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'work,urgent',
    description: 'Comma-separated tags, AND semantics (memo must carry all)',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'high,medium',
    description: 'Comma-separated priorities, OR semantics',
  })
  @IsOptional()
  @IsString()
  priorities?: string;
}

function splitList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** Validates and maps the raw filter params; throws 422 on bad input. */
function parseFilters(query: ListMemosQuery): MemoFilters {
  const filters: MemoFilters = {};
  const tags = splitList(query.tags);
  if (tags) {
    for (const tag of tags) {
      if (tag.length > 32) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'each tag must be at most 32 characters (E52)',
        );
      }
    }
    filters.tags = tags;
  }
  const priorities = splitList(query.priorities);
  if (priorities) {
    for (const p of priorities) {
      if (!(MEMO_PRIORITIES as readonly string[]).includes(p)) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'priorities must be valid priority values (E53)',
        );
      }
    }
    filters.priorities = priorities as MemoPriority[];
  }
  return filters;
}

@ApiTags('memos')
@Controller('memos')
export class MemoController {
  constructor(
    @Inject(MemoService) private readonly memoService: MemoService,
    @Inject(MemoImagesService) private readonly memoImagesService: MemoImagesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List the user\'s raw memos whose repeat window intersects [from, to) (client expands repeats)',
  })
  @ApiOkResponse({ type: [MemoDtoSchema] })
  listMemos(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(ListMemosQuery) query: ListMemosQuery,
  ): Promise<MemoDto[]> {
    return this.memoService.list(
      user.userId,
      query.from ?? new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10),
      query.to ?? new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10),
      parseFilters(query),
    );
  }

  @Get('tags')
  @ApiOperation({
    summary: 'Tag aggregate across all of the user\'s memos (filter sidebar candidates, M2)',
  })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  listTags(@CurrentUser() user: AuthPrincipal): Promise<TagCountDto[]> {
    return this.memoService.tagCounts(user.userId);
  }

  @Patch('tags')
  @ApiOperation({
    summary: 'Rename a tag across all of the user\'s memos (merges when the target exists)',
  })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  renameTag(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(RenameTagBody) body: RenameTagBody,
  ): Promise<TagCountDto[]> {
    return this.memoService.renameTag(user.userId, body.from, body.to);
  }

  @Delete('tags/:tag')
  @ApiOperation({ summary: 'Remove a tag from all of the user\'s memos' })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  removeTag(
    @CurrentUser() user: AuthPrincipal,
    @Param('tag') tag: string,
  ): Promise<TagCountDto[]> {
    return this.memoService.removeTag(user.userId, decodeURIComponent(tag));
  }

  @Post()
  @ApiOperation({ summary: 'Create a memo (idempotent on the client-generated id, E47)' })
  @ApiCreatedResponse({ type: MemoDtoSchema })
  createMemo(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateMemoBody) body: CreateMemoBody,
  ): Promise<MemoDto> {
    return this.memoService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single memo' })
  @ApiOkResponse({ type: MemoDtoSchema })
  getMemo(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<MemoDto> {
    return this.memoService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a memo (optimistic lock via updatedAt, E49)' })
  @ApiOkResponse({ type: MemoDtoSchema })
  updateMemo(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateMemoBody) body: UpdateMemoBody,
  ): Promise<MemoDto> {
    return this.memoService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a memo (soft delete; completions cascade)' })
  @ApiNoContentResponse({ description: 'Memo deleted' })
  async deleteMemo(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.memoService.remove(user.userId, id);
  }

  @Delete(':id/instances/:date')
  @ApiOperation({
    summary:
      'Delete one instance of a repeating memo (adds the date to excludedDates; idempotent; E50 for non-occurrences)',
  })
  @ApiOkResponse({ type: MemoDtoSchema })
  deleteInstance(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Param('date') date: string,
  ): Promise<MemoDto> {
    return this.memoService.removeInstance(user.userId, id, date);
  }

  @Put(':id/completion')
  @ApiOperation({
    summary:
      'Toggle completion: non-repeating via completedAt (date must equal memo.date, E51); repeating per instance date (must be an occurrence, E50)',
  })
  @ApiOkResponse({ type: MemoDtoSchema })
  setCompletion(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(SetMemoCompletionBody) body: SetMemoCompletionBody,
  ): Promise<MemoDto> {
    return this.memoService.setCompletion(user.userId, id, body);
  }

  // -- Images (M3): file bodies live in object storage, DB keeps metadata --

  @Get(':id/images')
  @ApiOperation({ summary: "List a memo's images (metadata only, oldest first)" })
  @ApiOkResponse({ type: [MemoImageDtoSchema] })
  listImages(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') memoId: string,
  ): Promise<MemoImageDtoSchema[]> {
    return this.memoImagesService.list(user.userId, memoId);
  }

  @Post(':id/images')
  @ApiOperation({
    summary:
      'Upload one image (multipart: file + client-generated id; idempotent on id, E58); magic-byte sniffed, <= 5MB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: MemoImageDtoSchema })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MEMO_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  uploadImage(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') memoId: string,
    @ValidatedBody(UploadImageBody) body: UploadImageBody,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MemoImageDtoSchema> {
    if (!file) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'file is required');
    }
    return this.memoImagesService.upload(user.userId, memoId, body.id, {
      buffer: file.buffer,
      originalName: file.originalname,
      declaredMime: file.mimetype,
      size: file.size,
    });
  }

  @Delete(':id/images/:imageId')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Delete an image (metadata first; object removal failure still succeeds, E63)',
  })
  @ApiNoContentResponse({ description: 'Image deleted' })
  async deleteImage(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') memoId: string,
    @Param('imageId') imageId: string,
  ): Promise<void> {
    await this.memoImagesService.remove(user.userId, memoId, imageId);
  }

  @Get('images/:imageId/file')
  @ApiOperation({
    summary: 'Download an image body through the authenticated API (streams from object storage)',
  })
  async imageFile(
    @CurrentUser() user: AuthPrincipal,
    @Param('imageId') imageId: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.memoImagesService.file(user.userId, imageId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    (file.stream as unknown as Readable).pipe(res);
  }
}
