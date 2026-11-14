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
import type { GoalDto } from '@chpli2/shared';
import { ValidatedBody } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { GoalsService } from './goals.service';
import {
  AddGoalLinkBody,
  CreateGoalBody,
  CreateMilestoneBody,
  GoalDtoSchema,
  UpdateGoalBody,
  UpdateMilestoneBody,
} from './goals.dto';

@ApiTags('goals')
@Controller('goals')
export class GoalsController {
  constructor(@Inject(GoalsService) private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: "List the user's goals with milestones, derived progress and resolved links" })
  @ApiOkResponse({ type: [GoalDtoSchema] })
  listGoals(@CurrentUser() user: AuthPrincipal): Promise<GoalDto[]> {
    return this.goalsService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a goal (idempotent on the client-generated id)' })
  @ApiCreatedResponse({ type: GoalDtoSchema })
  createGoal(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateGoalBody) body: CreateGoalBody,
  ): Promise<GoalDto> {
    return this.goalsService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single goal' })
  @ApiOkResponse({ type: GoalDtoSchema })
  getGoal(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<GoalDto> {
    return this.goalsService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal (optimistic lock via updatedAt)' })
  @ApiOkResponse({ type: GoalDtoSchema })
  updateGoal(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateGoalBody) body: UpdateGoalBody,
  ): Promise<GoalDto> {
    return this.goalsService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a goal (soft delete; milestones and links cascade)' })
  @ApiNoContentResponse({ description: 'Goal deleted' })
  async deleteGoal(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.goalsService.remove(user.userId, id);
  }

  @Post(':id/milestones')
  @ApiOperation({ summary: 'Add a milestone (idempotent on the client-generated id)' })
  @ApiCreatedResponse({ type: GoalDtoSchema })
  addMilestone(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(CreateMilestoneBody) body: CreateMilestoneBody,
  ): Promise<GoalDto> {
    return this.goalsService.addMilestone(user.userId, id, body);
  }

  @Patch(':goalId/milestones/:milestoneId')
  @ApiOperation({ summary: 'Update a milestone (title/date/status; done records completedAt)' })
  @ApiOkResponse({ type: GoalDtoSchema })
  updateMilestone(
    @CurrentUser() user: AuthPrincipal,
    @Param('goalId') goalId: string,
    @Param('milestoneId') milestoneId: string,
    @ValidatedBody(UpdateMilestoneBody) body: UpdateMilestoneBody,
  ): Promise<GoalDto> {
    return this.goalsService.updateMilestone(user.userId, goalId, milestoneId, body);
  }

  @Delete(':goalId/milestones/:milestoneId')
  @ApiOperation({ summary: 'Delete a milestone (progress recomputes automatically)' })
  @ApiOkResponse({ type: GoalDtoSchema })
  deleteMilestone(
    @CurrentUser() user: AuthPrincipal,
    @Param('goalId') goalId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<GoalDto> {
    return this.goalsService.removeMilestone(user.userId, goalId, milestoneId);
  }

  @Put(':id/links')
  @ApiOperation({
    summary:
      'Link a note/bookmark (validated through the owning module; idempotent)',
  })
  @ApiOkResponse({ type: GoalDtoSchema })
  addLink(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(AddGoalLinkBody) body: AddGoalLinkBody,
  ): Promise<GoalDto> {
    return this.goalsService.addLink(user.userId, id, body);
  }

  @Delete(':id/links/:linkId')
  @ApiOperation({ summary: 'Remove a link' })
  @ApiOkResponse({ type: GoalDtoSchema })
  removeLink(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ): Promise<GoalDto> {
    return this.goalsService.removeLink(user.userId, id, linkId);
  }
}
