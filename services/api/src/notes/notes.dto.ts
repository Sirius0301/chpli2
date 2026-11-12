import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
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
  NOTE_BODY_MAX_BYTES,
  NOTE_TITLE_MAX_LENGTH,
} from '@chpli2/shared';

export class CreateNoteBody {
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

export class UpdateNoteBody {
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
