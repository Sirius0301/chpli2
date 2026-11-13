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
import { Readable } from 'node:stream';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { BookmarkDto, BookmarkSort } from '@chpli2/shared';
import { BOOKMARK_SORTS, ERROR_CODES, MEMO_IMAGE_MAX_BYTES } from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { unprocessableException } from '../shared/http-error';
import { BookmarksService } from './bookmarks.service';
import {
  BookmarkDtoSchema,
  CreateBookmarkBody,
  ListBookmarksQuery,
  UpdateBookmarkBody,
} from './bookmarks.dto';

@ApiTags('bookmarks')
@Controller('bookmarks')
export class BookmarksController {
  constructor(@Inject(BookmarksService) private readonly bookmarksService: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: "List the user's bookmarks (server-sorted, inactive flag included)" })
  @ApiOkResponse({ type: [BookmarkDtoSchema] })
  listBookmarks(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(ListBookmarksQuery) query: ListBookmarksQuery,
  ): Promise<BookmarkDto[]> {
    const sort = (BOOKMARK_SORTS as readonly string[]).includes(query.sort ?? '')
      ? (query.sort as BookmarkSort)
      : 'recent';
    return this.bookmarksService.list(user.userId, sort);
  }

  @Post()
  @ApiOperation({ summary: 'Create a bookmark (idempotent on the client-generated id, E93)' })
  @ApiCreatedResponse({ type: BookmarkDtoSchema })
  createBookmark(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateBookmarkBody) body: CreateBookmarkBody,
  ): Promise<BookmarkDto> {
    return this.bookmarksService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bookmark' })
  @ApiOkResponse({ type: BookmarkDtoSchema })
  getBookmark(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<BookmarkDto> {
    return this.bookmarksService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bookmark (optimistic lock via updatedAt, E92)' })
  @ApiOkResponse({ type: BookmarkDtoSchema })
  updateBookmark(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateBookmarkBody) body: UpdateBookmarkBody,
  ): Promise<BookmarkDto> {
    return this.bookmarksService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a bookmark (soft delete; cover object removed best-effort)' })
  @ApiNoContentResponse({ description: 'Bookmark deleted' })
  async deleteBookmark(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.bookmarksService.remove(user.userId, id);
  }

  @Post(':id/click')
  @ApiOperation({ summary: 'Record a click (count +1, lastClickedAt=now, B1 D4)' })
  @ApiCreatedResponse({ type: BookmarkDtoSchema })
  click(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<BookmarkDto> {
    return this.bookmarksService.click(user.userId, id);
  }

  @Put(':id/cover')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload/replace the cover image (magic-byte sniffed, <= 5MB, E91)' })
  @ApiOkResponse({ type: BookmarkDtoSchema })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MEMO_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  uploadCover(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BookmarkDto> {
    if (!file) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'file is required');
    }
    return this.bookmarksService.uploadCover(user.userId, id, {
      buffer: file.buffer,
      originalName: file.originalname,
      size: file.size,
    });
  }

  @Get(':id/cover/file')
  @ApiOperation({ summary: 'Download the cover through the authenticated API (streams from object storage)' })
  async coverFile(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.bookmarksService.coverFile(user.userId, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    (file.stream as unknown as Readable).pipe(res);
  }
}
