import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { SKILL_LEVELS, SKILL_NAME_MAX_LENGTH } from '@chpli2/shared';
import type { SkillLevel } from '@chpli2/shared';
import { GoalLinkDtoSchema } from './goals.dto';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateSkillBody {
  @ApiProperty({ type: 'string', format: 'uuid', description: 'Client-generated id (idempotent create)' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: 'string', example: 'Distributed systems' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SKILL_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({ type: 'integer', enum: SKILL_LEVELS, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: SkillLevel;

  @ApiPropertyOptional({ type: 'string', format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  goalId?: string | null;
}

export class UpdateSkillBody {
  @ApiPropertyOptional({ type: 'string' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(SKILL_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ type: 'integer', enum: SKILL_LEVELS })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: SkillLevel;

  @ApiPropertyOptional({ type: 'string', format: 'uuid', nullable: true })
  @IsOptional()
  @IsString()
  goalId?: string | null;

  @ApiPropertyOptional({ type: 'string', description: 'Current updatedAt; mismatch -> 409' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAt?: string;
}

export class SkillDtoSchema {
  @ApiProperty({ type: 'string', format: 'uuid' })
  id!: string;

  @ApiProperty({ type: 'string' })
  name!: string;

  @ApiProperty({ type: 'integer', enum: SKILL_LEVELS })
  level!: number;

  @ApiProperty({ type: 'string', format: 'uuid', nullable: true })
  goalId!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  goalTitle!: string | null;

  @ApiProperty({ type: () => [GoalLinkDtoSchema] })
  links!: GoalLinkDtoSchema[];

  @ApiProperty({ type: 'string' })
  createdAt!: string;

  @ApiProperty({ type: 'string' })
  updatedAt!: string;
}
