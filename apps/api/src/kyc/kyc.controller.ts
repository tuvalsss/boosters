import { createReadStream } from 'node:fs';
import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KycDocumentType, KycIdentityDocumentType, KycStatus, type User } from '@boosters/db';
import type { FastifyReply } from 'fastify';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators.js';
import { KycService } from './kyc.service.js';

class KycWebhookDto {
  @IsString()
  userId!: string;

  @IsString()
  status!: string;

  @IsString()
  signature!: string;
}

class ManualKycDocumentDto {
  @IsEnum(KycDocumentType)
  type!: KycDocumentType;

  @IsString()
  @MaxLength(160)
  fileName!: string;

  @IsString()
  @MaxLength(80)
  contentType!: string;

  @IsString()
  dataUrl!: string;
}

class ManualKycDto {
  @IsEnum(KycIdentityDocumentType)
  documentType!: KycIdentityDocumentType;

  @IsString()
  @MaxLength(120)
  legalName!: string;

  @IsString()
  @MaxLength(2)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ManualKycDocumentDto)
  documents!: ManualKycDocumentDto[];
}

class KycReviewDto {
  @IsEnum(KycStatus)
  status!: KycStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewerNotes?: string;
}

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('status')
  status(@CurrentUser() user: User) {
    return this.kyc.getStatus(user);
  }

  @Post('start')
  start(@CurrentUser() user: User) {
    return this.kyc.start(user);
  }

  @Post('manual')
  submitManual(@CurrentUser() user: User, @Body() dto: ManualKycDto) {
    return this.kyc.submitManual(user, dto);
  }

  @Get('submissions/:id')
  submission(@CurrentUser() user: User, @Param('id') id: string) {
    return this.kyc.getSubmissionForUser(user, id);
  }

  @Get('documents/:id')
  async document(@CurrentUser() user: User, @Param('id') id: string, @Res() reply: FastifyReply) {
    const doc = await this.kyc.getDocument(user, id);
    reply.header('Content-Disposition', `inline; filename="${doc.fileName.replace(/"/g, '')}"`);
    reply.type(doc.contentType);
    return reply.send(createReadStream(doc.path));
  }

  /** Provider webhook (Veriff/Sumsub). HMAC-verified; gated by ENABLE_REAL_KYC. */
  @Public()
  @Post('webhook')
  webhook(@Body() dto: KycWebhookDto) {
    return this.kyc.handleWebhook(dto);
  }
}

@Controller('admin/kyc')
@Roles('ADMIN', 'OPS')
export class AdminKycController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  list(@Query('status') status?: KycStatus | 'ALL') {
    return this.kyc.listForAdmin(status && status !== 'ALL' ? status : undefined);
  }

  @Patch(':id/review')
  review(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: KycReviewDto) {
    return this.kyc.review(actor, id, dto);
  }
}
