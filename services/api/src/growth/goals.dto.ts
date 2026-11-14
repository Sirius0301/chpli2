import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import type { GoalDto } from '@chpli2/shared';
import { GOAL_LINK_MODULES, GOAL_STATUSES, GOAL_TITLE_MAX_LENGTH } from '@chpli2/shared';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateGoalBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'Become a staff engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(GOAL_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: 'string', enum: GOAL_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(GOAL_STATUSES as unknown as string[])
  status?: GoalDto['status'];

  @ApiPropertyOptional({ type: 'string', nullable: true, example: '2027-06-30' })
  @IsOptional()
  @Matches(DATE_KEY_RE, { message: 'targetDate must be YYYY-MM-DD' })
  targetDate?: string | null;
}

export class UpdateGoalBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(GOAL_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: 'string', enum: GOAL_STATUSES })
  @IsOptional()
  @IsIn(GOAL_STATUSES as unknown as string[])
  status?: GoalDto['status'];

  @ApiPropertyOptional({ type: 'string', nullable: true, example: '2027-06-30' })
  @IsOptional()
  @Matches(DATE_KEY_RE, { message: 'targetDate must be YYYY-MM-DD' })
  targetDate?: string | null;

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

export class CreateMilestoneBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'Ship the migration' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(GOAL_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true, example: '2026-12-31' })
  @IsOptional()
  @Matches(DATE_KEY_RE, { message: 'date must be YYYY-MM-DD' })
  date?: string | null;
}

export class UpdateMilestoneBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(GOAL_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  @IsOptional()
  @Matches(DATE_KEY_RE, { message: 'date must be YYYY-MM-DD' })
  date?: string | null;

  @ApiPropertyOptional({ type: 'string', enum: ['open', 'done'] })
  @IsOptional()
  @IsIn(['open', 'done'])
  status?: 'open' | 'done';
}

export class AddGoalLinkBody {
  @ApiProperty({ type: 'string', enum: GOAL_LINK_MODULES })
  @IsIn(GOAL_LINK_MODULES as unknown as string[])
  module!: 'notes' | 'bookmarks';

  @ApiProperty({ type: 'string', description: 'Stable id of the target in the owning module' })
  @IsString()
  @IsNotEmpty()
  refId!: string;
}

export class GoalLinkDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string', enum: GOAL_LINK_MODULES })
  module!: string;

  @ApiProperty({ type: 'string' })
  refId!: string;

  @ApiProperty({ type: 'string', description: 'Resolved via the owning module (dangling links omitted)' })
  title!: string;

  @ApiProperty({ type: 'string' })
  createdAt!: string;
}

export class MilestoneDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string', format: 'uuid' })
  goalId!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', nullable: true, example: '2026-12-31' })
  date!: string | null;

  @ApiProperty({ type: 'string', enum: ['open', 'done'] })
  status!: string;

  @ApiProperty({ type: 'string', nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}

export class GoalDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  title!: string;

  @ApiProperty({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ type: 'string', enum: GOAL_STATUSES })
  status!: string;

  @ApiProperty({ type: 'string', nullable: true, example: '2027-06-30' })
  targetDate!: string | null;

  @ApiProperty({ type: 'integer', description: 'Derived from milestones (done/total)' })
  progress!: number;

  @ApiProperty({ type: () => [MilestoneDtoSchema] })
  milestones!: MilestoneDtoSchema[];

  @ApiProperty({ type: () => [GoalLinkDtoSchema] })
  links!: GoalLinkDtoSchema[];

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}
