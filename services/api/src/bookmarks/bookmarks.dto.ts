import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { BookmarkDto } from '@chpli2/shared';
import {
  BOOKMARK_CATEGORIES_MAX_COUNT,
  BOOKMARK_CATEGORY_MAX_LENGTH,
  BOOKMARK_DESCRIPTION_MAX_LENGTH,
  BOOKMARK_SORTS,
  BOOKMARK_TITLE_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
} from '@chpli2/shared';

export class CreateBookmarkBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create, E93)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'TypeScript docs' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOKMARK_TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ type: 'string', example: 'https://www.typescriptlang.org/docs/' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(BOOKMARK_URL_MAX_LENGTH)
  url!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(BOOKMARK_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'string' } })
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(BOOKMARK_CATEGORIES_MAX_COUNT)
  @MaxLength(BOOKMARK_CATEGORY_MAX_LENGTH, { each: true })
  categories?: string[];
}

export class UpdateBookmarkBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(BOOKMARK_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(BOOKMARK_URL_MAX_LENGTH)
  url?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(BOOKMARK_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'string' } })
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(BOOKMARK_CATEGORIES_MAX_COUNT)
  @MaxLength(BOOKMARK_CATEGORY_MAX_LENGTH, { each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409 (E92)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

export class ListBookmarksQuery {
  @ApiPropertyOptional({ type: 'string', enum: BOOKMARK_SORTS, default: 'recent' })
  @IsOptional()
  @IsIn(BOOKMARK_SORTS as unknown as string[])
  sort?: string;
}

export class BookmarkDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  url!: string;

  @ApiProperty({ type: 'string' })
  domain!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'array', items: { type: 'string' } })
  categories!: string[];

  @ApiProperty({ type: 'boolean' })
  hasCover!: boolean;

  @ApiProperty({ type: 'integer' })
  clickCount!: number;

  @ApiProperty({ type: 'string', nullable: true })
  lastClickedAt!: string | null;

  @ApiProperty({ type: 'boolean', description: 'Not clicked within 30 days (B1 D5)' })
  inactive!: boolean;

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}
