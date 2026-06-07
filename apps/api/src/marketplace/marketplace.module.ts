import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service.js';
import {
  AdminReviewController,
  MarketplaceController,
  WalletController,
} from './marketplace.controller.js';
import { BubblegumTransferrer } from './bubblegum.transferrer.js';
import { CNFT_TRANSFERRER } from './cnft-transferrer.js';

@Module({
  controllers: [MarketplaceController, WalletController, AdminReviewController],
  providers: [MarketplaceService, { provide: CNFT_TRANSFERRER, useClass: BubblegumTransferrer }],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
