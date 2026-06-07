import { Module } from '@nestjs/common';
import { VaultModule } from '../vault/vault.module.js';
import { SubmissionsService } from './submissions.service.js';
import { AdminSubmissionsController, SubmissionsController } from './submissions.controller.js';

@Module({
  imports: [VaultModule],
  controllers: [SubmissionsController, AdminSubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
