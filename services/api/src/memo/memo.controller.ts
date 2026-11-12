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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import type { MemoDto, MemoPriority, TagCountDto } from '@chpli2/shared';
import { ERROR_CODES, MEMO_PRIORITIES } from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { unprocessableException } from '../shared/http-error';
import { MemoService, type MemoFilters } from './memo.service';
import {
  CreateMemoBody,
  MemoDtoSchema,
  SetMemoCompletionBody,
  TagCountDtoSchema,
  UpdateMemoBody,
} from './memo.dto';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ListMemosQuery {
  @ApiPropertyOptional({ type: 'string', example: '2026-11-01', description: 'YYYY-MM-DD (inclusive)' })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  from?: string;

  @ApiPropertyOptional({ type: 'string', example: '2026-12-01', description: 'YYYY-MM-DD (exclusive)' })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_RE)
  to?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'work,urgent',
    description: 'Comma-separated tags, AND semantics (memo must carry all)',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    type: 'string',
    example: 'high,medium',
    description: 'Comma-separated priorities, OR semantics',
  })
  @IsOptional()
  @IsString()
  priorities?: string;
}

function splitList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const items = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** Validates and maps the raw filter params; throws 422 on bad input. */
function parseFilters(query: ListMemosQuery): MemoFilters {
  const filters: MemoFilters = {};
  const tags = splitList(query.tags);
  if (tags) {
    for (const tag of tags) {
      if (tag.length > 32) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'each tag must be at most 32 characters (E52)',
        );
      }
    }
    filters.tags = tags;
  }
  const priorities = splitList(query.priorities);
  if (priorities) {
    for (const p of priorities) {
      if (!(MEMO_PRIORITIES as readonly string[]).includes(p)) {
        throw unprocessableException(
          ERROR_CODES.VALIDATION_ERROR,
          'priorities must be valid priority values (E53)',
        );
      }
    }
    filters.priorities = priorities as MemoPriority[];
  }
  return filters;
}

@ApiTags('memos')
@Controller('memos')
export class MemoController {
  constructor(@Inject(MemoService) private readonly memoService: MemoService) {}

  @Get()
  @ApiOperation({
    summary:
      'List the user\'s raw memos whose repeat window intersects [from, to) (client expands repeats)',
  })
  @ApiOkResponse({ type: [MemoDtoSchema] })
  listMemos(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(ListMemosQuery) query: ListMemosQuery,
  ): Promise<MemoDto[]> {
    return this.memoService.list(
      user.userId,
      query.from ?? new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10),
      query.to ?? new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10),
      parseFilters(query),
    );
  }

  @Get('tags')
  @ApiOperation({
    summary: 'Tag aggregate across all of the user\'s memos (filter sidebar candidates, M2)',
  })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  listTags(@CurrentUser() user: AuthPrincipal): Promise<TagCountDto[]> {
    return this.memoService.tagCounts(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a memo (idempotent on the client-generated id, E47)' })
  @ApiCreatedResponse({ type: MemoDtoSchema })
  createMemo(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateMemoBody) body: CreateMemoBody,
  ): Promise<MemoDto> {
    return this.memoService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single memo' })
  @ApiOkResponse({ type: MemoDtoSchema })
  getMemo(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<MemoDto> {
    return this.memoService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a memo (optimistic lock via updatedAt, E49)' })
  @ApiOkResponse({ type: MemoDtoSchema })
  updateMemo(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateMemoBody) body: UpdateMemoBody,
  ): Promise<MemoDto> {
    return this.memoService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a memo (soft delete; completions cascade)' })
  @ApiNoContentResponse({ description: 'Memo deleted' })
  async deleteMemo(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.memoService.remove(user.userId, id);
  }

  @Put(':id/completion')
  @ApiOperation({
    summary:
      'Toggle completion: non-repeating via completedAt (date must equal memo.date, E51); repeating per instance date (must be an occurrence, E50)',
  })
  @ApiOkResponse({ type: MemoDtoSchema })
  setCompletion(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(SetMemoCompletionBody) body: SetMemoCompletionBody,
  ): Promise<MemoDto> {
    return this.memoService.setCompletion(user.userId, id, body);
  }
}
