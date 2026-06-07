import { Module } from '@nestjs/common';
import { BuybackService } from './buyback.service.js';
import { AdminBuybackController, BuybackController } from './buyback.controller.js';

@Module({
  controllers: [BuybackController, AdminBuybackController],
  providers: [BuybackService],
  exports: [BuybackService],
})
export class BuybackModule {}
