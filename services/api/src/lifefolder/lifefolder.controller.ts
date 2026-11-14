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
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { LifeCategoryDto, LifeDocumentDto, LifeTemplateDto } from '@chpli2/shared';
import { LIFE_DOC_MAX_BYTES } from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { unprocessableException } from '../shared/http-error';
import { ERROR_CODES } from '@chpli2/shared';
import { LifeFolderService } from './lifefolder.service';
import {
  CategoryDtoSchema,
  CreateCategoryBody,
  CreateDocumentFieldsBody,
  DocumentDtoSchema,
  TemplateDtoSchema,
  UpdateDocumentBody,
} from './lifefolder.dto';

export class DocumentsQuery {
  @ApiPropertyOptional({ type: 'string', description: 'Filter by category id' })
  @IsOptional()
  @IsString()
  category_id?: string;
}

@ApiTags('life-folder')
@Controller('life-folder')
export class LifeFolderController {
  constructor(@Inject(LifeFolderService) private readonly lifeFolder: LifeFolderService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Category tree (built-in + user custom, depth <= 2)' })
  @ApiOkResponse({ type: [CategoryDtoSchema] })
  categories(@CurrentUser() user: AuthPrincipal): Promise<LifeCategoryDto[]> {
    return this.lifeFolder.categories(user.userId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a custom category (E109 rules)' })
  @ApiCreatedResponse({ type: CategoryDtoSchema })
  async createCategory(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateCategoryBody) body: CreateCategoryBody,
  ): Promise<LifeCategoryDto[]> {
    await this.lifeFolder.createCategory(user.userId, body);
    return this.lifeFolder.categories(user.userId);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a custom category (built-in blocked; non-empty 422)' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  async deleteCategory(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.lifeFolder.removeCategory(user.userId, id);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Built-in document templates' })
  @ApiOkResponse({ type: [TemplateDtoSchema] })
  templates(): Promise<LifeTemplateDto[]> {
    return this.lifeFolder.templates();
  }

  @Get('documents')
  @ApiOperation({ summary: "List the user's documents (optionally by category)" })
  @ApiOkResponse({ type: [DocumentDtoSchema] })
  documents(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(DocumentsQuery) query: DocumentsQuery,
  ): Promise<LifeDocumentDto[]> {
    return this.lifeFolder.documents(user.userId, query.category_id);
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a document (multipart: file + fields; magic-byte sniffed PDF/images, <= 10MB; sensitive defaults true)',
  })
  @ApiCreatedResponse({ type: DocumentDtoSchema })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: LIFE_DOC_MAX_BYTES, files: 1 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateDocumentFieldsBody) fields: CreateDocumentFieldsBody,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<LifeDocumentDto> {
    if (!file) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'file is required');
    }
    return this.lifeFolder.createDocument(user.userId, fields, {
      buffer: file.buffer,
      originalName: file.originalname,
      size: file.size,
    });
  }

  @Patch('documents/:id')
  @ApiOperation({ summary: 'Update metadata / move category (optimistic lock via updatedAt)' })
  @ApiOkResponse({ type: DocumentDtoSchema })
  updateDocument(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateDocumentBody) body: UpdateDocumentBody,
  ): Promise<LifeDocumentDto> {
    return this.lifeFolder.updateDocument(user.userId, id, body);
  }

  @Delete('documents/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a document (soft delete; object removed best-effort)' })
  @ApiNoContentResponse({ description: 'Document deleted' })
  async deleteDocument(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
  ): Promise<void> {
    await this.lifeFolder.removeDocument(user.userId, id);
  }

  @Put('documents/:id/file')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Replace the file body (old object removed best-effort)' })
  @ApiOkResponse({ type: DocumentDtoSchema })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: LIFE_DOC_MAX_BYTES, files: 1 },
    }),
  )
  replaceFile(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<LifeDocumentDto> {
    if (!file) {
      throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'file is required');
    }
    return this.lifeFolder.replaceFile(user.userId, id, {
      buffer: file.buffer,
      originalName: file.originalname,
      size: file.size,
    });
  }

  @Get('documents/:id/file')
  @ApiOperation({ summary: 'Download the document through the authenticated API' })
  async file(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.lifeFolder.file(user.userId, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    (file.stream as unknown as Readable).pipe(res);
  }
}
