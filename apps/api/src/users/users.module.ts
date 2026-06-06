import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { AdminController } from './admin.controller.js';
import { KycService } from '../kyc/kyc.service.js';
import { KycController } from '../kyc/kyc.controller.js';

@Module({
  controllers: [UsersController, AdminController, KycController],
  providers: [UsersService, KycService],
  exports: [UsersService],
})
export class UsersModule {}
