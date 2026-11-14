import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CATEGORY_NAME_MAX_LENGTH,
  DOCUMENT_NOTES_MAX_LENGTH,
  DOCUMENT_TITLE_MAX_LENGTH,
} from '@chpli2/shared';

export class CreateCategoryBody {
  @ApiProperty({ type: 'string', example: '保险合同' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true, description: 'Parent category (depth <= 2)' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class CreateDocumentFieldsBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: '我的身份证' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DOCUMENT_TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ type: 'string' })
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DOCUMENT_NOTES_MAX_LENGTH)
  notes?: string | null;

  @ApiPropertyOptional({ type: 'boolean', default: true, description: 'Private by default' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  sensitive?: boolean;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  templateId?: string | null;
}

export class UpdateDocumentBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DOCUMENT_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DOCUMENT_NOTES_MAX_LENGTH)
  notes?: string | null;

  @ApiPropertyOptional({ type: 'boolean' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : value === true || value === 'true'))
  @IsBoolean()
  sensitive?: boolean;

  @ApiPropertyOptional({ type: 'string', description: 'Move target category' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

export class CategoryDtoSchema {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string', nullable: true })
  userId!: string | null;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string', nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: 'integer' })
  sortOrder!: number;

  @ApiProperty({ type: 'boolean' })
  builtIn!: boolean;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  children!: unknown[];
}

export class TemplateDtoSchema {
  @ApiProperty({ type: 'string' })
  id!: string;

  @ApiProperty({ type: 'string' })
  categoryId!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'string' })
  description!: string;

  @ApiProperty({ type: 'boolean' })
  recommended!: boolean;
}

export class DocumentDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  categoryId!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', nullable: true })
  notes!: string | null;

  @ApiProperty({ type: 'boolean' })
  sensitive!: boolean;

  @ApiProperty({ type: 'string', nullable: true })
  templateId!: string | null;

  @ApiProperty({ type: 'string' })
  fileName!: string;

  @ApiProperty({ type: 'string' })
  mimeType!: string;

  @ApiProperty({ type: 'integer' })
  sizeBytes!: number;

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}
