import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SubmissionStatus, type User } from '@boosters/db';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { RateLimit, RateLimitGuard } from '../ratelimit/rate-limit.guard.js';
import { SubmissionsService } from './submissions.service.js';
import {
  CreateSubmissionDto,
  GradeSubmissionDto,
  PhotosDto,
  ReceiveDto,
  RejectDto,
  ShipDto,
} from './submissions.dto.js';

/** User-facing consignment flow. */
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit('submission')
  create(@CurrentUser() user: User, @Body() dto: CreateSubmissionDto) {
    return this.submissions.create(user, dto);
  }

  @Get()
  listMine(@CurrentUser() user: User) {
    return this.submissions.listMine(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.submissions.get(user, id);
  }

  @Post(':id/label')
  label(@CurrentUser() user: User, @Param('id') id: string) {
    return this.submissions.generateLabel(user, id);
  }

  @Post(':id/ship')
  ship(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ShipDto) {
    return this.submissions.markShipped(user, id, dto.trackingNumber);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.submissions.cancel(user, id);
  }
}

/** Ops/admin consignment processing queue. */
@Controller('admin/submissions')
@Roles('ADMIN', 'OPS')
export class AdminSubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get()
  list(@Query('status') status?: string) {
    const parsed =
      status && (Object.values(SubmissionStatus) as string[]).includes(status)
        ? (status as SubmissionStatus)
        : undefined;
    return this.submissions.listForOps(parsed);
  }

  @Post(':id/receive')
  receive(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: ReceiveDto) {
    return this.submissions.receive(actor, id, dto);
  }

  @Post(':id/authenticate')
  authenticate(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.submissions.authenticate(actor, id);
  }

  @Post(':id/grade')
  grade(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: GradeSubmissionDto) {
    return this.submissions.grade(actor, id, dto.grade);
  }

  @Post(':id/photos')
  photos(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: PhotosDto) {
    return this.submissions.addPhotos(actor, id, dto.urls);
  }

  @Post(':id/mint')
  mint(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.submissions.mint(actor, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: RejectDto) {
    return this.submissions.reject(actor, id, dto.reason);
  }
}
