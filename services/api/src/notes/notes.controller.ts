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
import { IsOptional, IsString } from 'class-validator';
import type { NoteDto, NotePriority, TagCountDto } from '@chpli2/shared';
import { ERROR_CODES, MEMO_PRIORITIES } from '@chpli2/shared';
import { ValidatedBody, ValidatedQuery } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { unprocessableException } from '../shared/http-error';
import { NotesService, type NoteFilters } from './notes.service';
import { CreateNoteBody, NoteDtoSchema, TagCountDtoSchema, UpdateNoteBody } from './notes.dto';

export class ListNotesQuery {
  @ApiPropertyOptional({ type: 'string', example: 'work,ideas', description: 'Comma-separated tags, AND semantics' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ type: 'string', example: 'high,medium', description: 'Comma-separated priorities, OR semantics' })
  @IsOptional()
  @IsString()
  priorities?: string;
}

function splitList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function parseFilters(query: ListNotesQuery): NoteFilters {
  const filters: NoteFilters = {};
  const tags = splitList(query.tags);
  if (tags) {
    for (const tag of tags) {
      if (tag.length > 32) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'each tag must be at most 32 characters (E77)');
      }
    }
    filters.tags = tags;
  }
  const priorities = splitList(query.priorities);
  if (priorities) {
    for (const p of priorities) {
      if (!(MEMO_PRIORITIES as readonly string[]).includes(p)) {
        throw unprocessableException(ERROR_CODES.VALIDATION_ERROR, 'priorities must be valid priority values (E77)');
      }
    }
    filters.priorities = priorities as NotePriority[];
  }
  return filters;
}

@ApiTags('notes')
@Controller('notes')
export class NotesController {
  constructor(@Inject(NotesService) private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: "List the user's notes, most recently updated first" })
  @ApiOkResponse({ type: [NoteDtoSchema] })
  listNotes(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedQuery(ListNotesQuery) query: ListNotesQuery,
  ): Promise<NoteDto[]> {
    return this.notesService.list(user.userId, parseFilters(query));
  }

  @Get('tags')
  @ApiOperation({ summary: 'Tag aggregate across all of the user\'s notes (filter sidebar candidates)' })
  @ApiOkResponse({ type: [TagCountDtoSchema] })
  listTags(@CurrentUser() user: AuthPrincipal): Promise<TagCountDto[]> {
    return this.notesService.tagCounts(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a note (idempotent on the client-generated id, E79)' })
  @ApiCreatedResponse({ type: NoteDtoSchema })
  createNote(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateNoteBody) body: CreateNoteBody,
  ): Promise<NoteDto> {
    return this.notesService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single note' })
  @ApiOkResponse({ type: NoteDtoSchema })
  getNote(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<NoteDto> {
    return this.notesService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note (optimistic lock via updatedAt, E78)' })
  @ApiOkResponse({ type: NoteDtoSchema })
  updateNote(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateNoteBody) body: UpdateNoteBody,
  ): Promise<NoteDto> {
    return this.notesService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a note (soft delete)' })
  @ApiNoContentResponse({ description: 'Note deleted' })
  async deleteNote(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.notesService.remove(user.userId, id);
  }
}
