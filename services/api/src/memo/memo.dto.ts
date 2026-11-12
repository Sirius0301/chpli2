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
  Matches,
  MaxLength,
} from 'class-validator';
import type { MemoDto, TagCountDto } from '@chpli2/shared';
import {
  MEMO_PRIORITIES,
  MEMO_REPEAT_ALL,
  MEMO_TAG_MAX_LENGTH,
  MEMO_TAGS_MAX_COUNT,
  MEMO_TITLE_MAX_LENGTH,
} from '@chpli2/shared';

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Memo request bodies
// ---------------------------------------------------------------------------

export class CreateMemoBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create, E47)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'Buy groceries' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEMO_TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ type: 'string', example: '2026-11-12', description: 'YYYY-MM-DD (pure date, M1 D1)' })
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiPropertyOptional({ type: 'string', enum: MEMO_PRIORITIES, default: 'none' })
  @IsOptional()
  @IsIn(MEMO_PRIORITIES as string[])
  priority?: MemoDto['priority'];

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @ApiPropertyOptional({ type: 'string', enum: MEMO_REPEAT_ALL, default: 'none' })
  @IsOptional()
  @IsIn(MEMO_REPEAT_ALL as string[])
  repeat?: MemoDto['repeat'];

  @ApiPropertyOptional({
    type: 'string',
    nullable: true,
    example: '2027-11-12',
    description: 'YYYY-MM-DD, inclusive; null = repeats forever',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'repeatEnd must be YYYY-MM-DD' })
  repeatEnd?: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string' },
    description: `Free-text tags (max ${MEMO_TAGS_MAX_COUNT}, each <= ${MEMO_TAG_MAX_LENGTH} chars)`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MEMO_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(MEMO_TAG_MAX_LENGTH, { each: true })
  tags?: string[];
}

export class UpdateMemoBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEMO_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string', example: '2026-11-12' })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ type: 'string', enum: MEMO_PRIORITIES })
  @IsOptional()
  @IsIn(MEMO_PRIORITIES as string[])
  priority?: MemoDto['priority'];

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @ApiPropertyOptional({ type: 'string', enum: MEMO_REPEAT_ALL })
  @IsOptional()
  @IsIn(MEMO_REPEAT_ALL as string[])
  repeat?: MemoDto['repeat'];

  @ApiPropertyOptional({ type: 'string', nullable: true, example: '2027-11-12' })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'repeatEnd must be YYYY-MM-DD' })
  repeatEnd?: string | null;

  @ApiPropertyOptional({ type: 'array', items: { type: 'string' } })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MEMO_TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(MEMO_TAG_MAX_LENGTH, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409 (E49)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

export class SetMemoCompletionBody {
  @ApiProperty({ type: 'string', example: '2026-11-14', description: 'Instance date being toggled (YYYY-MM-DD)' })
  @IsString()
  @Matches(DATE_KEY_RE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ type: 'boolean' })
  @IsBoolean()
  completed!: boolean;
}

// ---------------------------------------------------------------------------
// Swagger response schemas
// ---------------------------------------------------------------------------

export class MemoDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', example: '2026-11-12' })
  date!: string;

  @ApiProperty({ type: 'string', enum: MEMO_PRIORITIES })
  priority!: string;

  @ApiProperty({ type: 'string', nullable: true })
  note!: string | null;

  @ApiProperty({ type: 'string', enum: MEMO_REPEAT_ALL })
  repeat!: string;

  @ApiProperty({ type: 'string', nullable: true, example: '2027-11-12' })
  repeatEnd!: string | null;

  @ApiProperty({ type: 'string', nullable: true, description: 'Non-repeating memos only (M1 D3)' })
  completedAt!: string | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'string', example: '2026-11-14' },
    description: 'Repeating memos only: completed instance dates',
  })
  completions!: string[];

  @ApiProperty({ type: 'array', items: { type: 'string' }, description: 'Free-text tags (M2)' })
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

export class MemoImageDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  memoId!: string;

  @ApiProperty({ type: 'string' })
  fileName!: string;

  @ApiProperty({ type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] })
  mimeType!: string;

  @ApiProperty({ type: 'integer' })
  sizeBytes!: number;

  @ApiProperty({ type: 'string' })
  createdAt!: string;
}
