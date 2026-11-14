import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { REVIEW_TITLE_MAX_LENGTH } from '@chpli2/shared';
import { GoalLinkDtoSchema } from './goals.dto';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateReviewBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'Q4 career review' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(REVIEW_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiPropertyOptional({ type: 'string', example: '2026-11-14' })
  @IsOptional()
  @Matches(DATE_KEY_RE, { message: 'reviewedAt must be YYYY-MM-DD' })
  reviewedAt?: string;

  @ApiPropertyOptional({ type: 'string', format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  goalId?: string | null;
}

export class UpdateReviewBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(REVIEW_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  content?: string | null;

  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @Matches(DATE_KEY_RE, { message: 'reviewedAt must be YYYY-MM-DD' })
  reviewedAt?: string;

  @ApiPropertyOptional({ type: 'string', format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  goalId?: string | null;

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

export class ScheduleNextMemoBody {
  @ApiProperty({ type: 'string', example: '2026-12-14', description: 'Pure date, today or later' })
  @Matches(DATE_KEY_RE, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}

export class ReviewDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', nullable: true })
  content!: string | null;

  @ApiProperty({ type: 'string', example: '2026-11-14' })
  reviewedAt!: string;

  @ApiProperty({ type: 'string', format: 'uuid', nullable: true })
  goalId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  goalTitle!: string | null;

  @ApiProperty({ type: () => [GoalLinkDtoSchema] })
  links!: GoalLinkDtoSchema[];

  @ApiProperty({ type: 'string', nullable: true, description: 'Scheduled next-review memo date (D6)' })
  nextMemoDate!: string | null;

  @ApiProperty({ type: 'string', format: 'uuid', nullable: true })
  nextMemoId!: string | null;

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}
