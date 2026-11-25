import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { NoteDto } from '@chpli2/shared';
import {
  MEMO_PRIORITIES,
  MEMO_TAG_MAX_LENGTH,
  MEMO_TAGS_MAX_COUNT,
  NOTE_ACCESS_PASSWORD_MAX_LENGTH,
  NOTE_BODY_MAX_BYTES,
  NOTE_CATEGORY_MAX_LENGTH,
  NOTE_EXCERPT_MAX_LENGTH,
  NOTE_PUBLISH_STATUSES,
  NOTE_TITLE_MAX_LENGTH,
} from '@chpli2/shared';

/** Shared publish-form field validators (create + update bodies). */
class PublishFields {
  @ApiPropertyOptional({ type: 'string', maxLength: NOTE_CATEGORY_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_CATEGORY_MAX_LENGTH)
  category?: string | null;

  @ApiPropertyOptional({ type: 'string', maxLength: NOTE_EXCERPT_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_EXCERPT_MAX_LENGTH)
  excerpt?: string | null;

  @ApiPropertyOptional({ type: 'boolean', default: true })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiPropertyOptional({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @ApiPropertyOptional({ type: 'string', maxLength: NOTE_ACCESS_PASSWORD_MAX_LENGTH, description: 'Empty/null = open access' })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_ACCESS_PASSWORD_MAX_LENGTH)
  accessPassword?: string | null;

  @ApiPropertyOptional({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;
}

export class CreateNoteBody extends PublishFields {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create, E79)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'Meeting notes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ type: 'string', description: `Markdown body (<= ${NOTE_BODY_MAX_BYTES} bytes)` })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_BODY_MAX_BYTES)
  body?: string;

  @ApiPropertyOptional({ type: 'string', enum: MEMO_PRIORITIES, default: 'none' })
  @IsOptional()
  @IsIn(MEMO_PRIORITIES as string[])
  priority?: NoteDto['priority'];

  @ApiPropertyOptional({ type: 'array', items: { type: 'string' } })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MEMO_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(MEMO_TAG_MAX_LENGTH, { each: true })
  tags?: string[];
}

export class UpdateNoteBody extends PublishFields {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_BODY_MAX_BYTES)
  body?: string;

  @ApiPropertyOptional({ type: 'string', enum: MEMO_PRIORITIES })
  @IsOptional()
  @IsIn(MEMO_PRIORITIES as string[])
  priority?: NoteDto['priority'];

  @ApiPropertyOptional({ type: 'array', items: { type: 'string' } })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MEMO_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(MEMO_TAG_MAX_LENGTH, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409 (E78)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;

  @ApiPropertyOptional({ type: 'string', enum: NOTE_PUBLISH_STATUSES, description: 'Sent by the publish-form buttons only' })
  @IsOptional()
  @IsIn(NOTE_PUBLISH_STATUSES as string[])
  publishStatus?: NoteDto['publishStatus'];

  @ApiPropertyOptional({ type: 'string', description: 'Required (future) when publishStatus === scheduled' })
  @IsOptional()
  @IsISO8601({ strict: true })
  publishAt?: string | null;
}

export class NoteDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', description: 'Markdown source' })
  body!: string;

  @ApiProperty({ type: 'string', enum: MEMO_PRIORITIES })
  priority!: string;

  @ApiProperty({ type: 'array', items: { type: 'string' } })
  tags!: string[];

  @ApiPropertyOptional({ type: 'string', nullable: true })
  category!: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  excerpt!: string | null;

  @ApiProperty({ type: 'boolean' })
  allowComments!: boolean;

  @ApiProperty({ type: 'boolean' })
  pinned!: boolean;

  @ApiProperty({ type: 'boolean', description: 'An access password is set (never returned)' })
  hasAccessPassword!: boolean;

  @ApiProperty({ type: 'boolean' })
  showOnHome!: boolean;

  @ApiProperty({ type: 'string', enum: NOTE_PUBLISH_STATUSES })
  publishStatus!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  publishAt!: string | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  publishedAt!: string | null;

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}

export class TagCountDtoSchema {
  @ApiProperty({ type: 'string' })
  tag!: string;

  @ApiProperty({ type: 'integer' })
  count!: number;
}

export class NoteSummaryDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;
}

export class NoteVersionDtoSchema {
  @ApiProperty({ type: 'integer' })
  seq!: number;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string' })
  body!: string;

  @ApiProperty({ type: 'string', enum: MEMO_PRIORITIES })
  priority!: string;

  @ApiProperty({ type: 'array', items: { type: 'string' } })
  tags!: string[];

  @ApiProperty({ type: 'string' })
  createdAt!: string;
}

export class NoteImageDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  noteId!: string;

  @ApiProperty({ type: 'string' })
  fileName!: string;

  @ApiProperty({ type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] })
  mimeType!: string;

  @ApiProperty({ type: 'integer' })
  sizeBytes!: number;

  @ApiProperty({ type: 'string' })
  createdAt!: string;
}
