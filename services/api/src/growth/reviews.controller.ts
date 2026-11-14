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
import type { ReviewDto } from '@chpli2/shared';
import { ValidatedBody } from '../shared/validate-dto';
import { CurrentUser, type AuthPrincipal } from '../auth/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { AddGoalLinkBody } from './goals.dto';
import {
  CreateReviewBody,
  ReviewDtoSchema,
  ScheduleNextMemoBody,
  UpdateReviewBody,
} from './reviews.dto';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: "List the user's reviews (reviewedAt desc) with resolved links" })
  @ApiOkResponse({ type: [ReviewDtoSchema] })
  listReviews(@CurrentUser() user: AuthPrincipal): Promise<ReviewDto[]> {
    return this.reviewsService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a review (idempotent on the client id; reviewedAt defaults to today)' })
  @ApiCreatedResponse({ type: ReviewDtoSchema })
  createReview(
    @CurrentUser() user: AuthPrincipal,
    @ValidatedBody(CreateReviewBody) body: CreateReviewBody,
  ): Promise<ReviewDto> {
    return this.reviewsService.create(user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review' })
  @ApiOkResponse({ type: ReviewDtoSchema })
  getReview(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<ReviewDto> {
    return this.reviewsService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a review (optimistic lock via updatedAt)' })
  @ApiOkResponse({ type: ReviewDtoSchema })
  updateReview(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(UpdateReviewBody) body: UpdateReviewBody,
  ): Promise<ReviewDto> {
    return this.reviewsService.update(user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a review (soft delete; links removed)' })
  @ApiNoContentResponse({ description: 'Review deleted' })
  async deleteReview(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.reviewsService.remove(user.userId, id);
  }

  @Put(':id/links')
  @ApiOperation({ summary: 'Link a memo (calendar reference) to a review' })
  @ApiOkResponse({ type: ReviewDtoSchema })
  addLink(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(AddGoalLinkBody) body: AddGoalLinkBody,
  ): Promise<ReviewDto> {
    return this.reviewsService.addLink(user.userId, id, body);
  }

  @Delete(':id/links/:linkId')
  @ApiOperation({ summary: 'Remove a review link' })
  @ApiOkResponse({ type: ReviewDtoSchema })
  removeLink(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ): Promise<ReviewDto> {
    return this.reviewsService.removeLink(user.userId, id, linkId);
  }

  @Post(':id/schedule-next-memo')
  @ApiOperation({
    summary: 'Arrange the next review as a memo (idempotent via nextMemoId, G2 D6)',
  })
  @ApiCreatedResponse({ type: ReviewDtoSchema })
  scheduleNextMemo(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @ValidatedBody(ScheduleNextMemoBody) body: ScheduleNextMemoBody,
  ): Promise<ReviewDto> {
    return this.reviewsService.scheduleNextMemo(user.userId, id, body);
  }
}
