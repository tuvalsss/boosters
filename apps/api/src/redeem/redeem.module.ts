import { Module } from '@nestjs/common';
import { RedeemService } from './redeem.service.js';
import { AdminRedeemController, RedeemController } from './redeem.controller.js';
import { BubblegumBurner } from './bubblegum.burner.js';
import { CNFT_BURNER } from './cnft-burner.js';

@Module({
  controllers: [RedeemController, AdminRedeemController],
  providers: [RedeemService, { provide: CNFT_BURNER, useClass: BubblegumBurner }],
  exports: [RedeemService],
})
export class RedeemModule {}
