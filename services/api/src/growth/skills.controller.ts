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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { SkillDto } from '@chpli2/shared';
import { ValidatedBody } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { SkillsService } from './skills.service';
import { CreateSkillBody, SkillDtoSchema, UpdateSkillBody } from './skills.dto';
import { AddGoalLinkBody } from './goals.dto';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(@Inject(SkillsService) private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: "List the user's skills with resolved links and owning goal" })
  @ApiOkResponse({ type: [SkillDtoSchema] })
  listSkills(@CurrentUser() user: AuthPrincipal): Promise<SkillDto[]> {
    return this.skillsService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a skill (idempotent on the client id; duplicate name 422)' })
  @ApiCreatedResponse({ type: SkillDtoSchema })
  createSkill(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateSkillBody) body: CreateSkillBody,
  ): Promise<SkillDto> {
    return this.skillsService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single skill' })
  @ApiOkResponse({ type: SkillDtoSchema })
  getSkill(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<SkillDto> {
    return this.skillsService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a skill (optimistic lock via updatedAt)' })
  @ApiOkResponse({ type: SkillDtoSchema })
  updateSkill(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateSkillBody) body: UpdateSkillBody,
  ): Promise<SkillDto> {
    return this.skillsService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a skill (soft delete; links removed)' })
  @ApiNoContentResponse({ description: 'Skill deleted' })
  async deleteSkill(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.skillsService.remove(user.userId, id);
  }

  @Put(':id/links')
  @ApiOperation({ summary: 'Link a note (evidence) or bookmark (resource) to a skill' })
  @ApiOkResponse({ type: SkillDtoSchema })
  addLink(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(AddGoalLinkBody) body: AddGoalLinkBody,
  ): Promise<SkillDto> {
    return this.skillsService.addLink(user.userId, id, body);
  }

  @Delete(':id/links/:linkId')
  @ApiOperation({ summary: 'Remove a skill link' })
  @ApiOkResponse({ type: SkillDtoSchema })
  removeLink(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ): Promise<SkillDto> {
    return this.skillsService.removeLink(user.userId, id, linkId);
  }
}
