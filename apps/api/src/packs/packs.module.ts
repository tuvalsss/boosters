import { Module } from '@nestjs/common';
import { PacksService } from './packs.service.js';
import { AdminPacksController, PacksController } from './packs.controller.js';
import { BubblegumTransferrer } from '../marketplace/bubblegum.transferrer.js';
import { CNFT_TRANSFERRER } from '../marketplace/cnft-transferrer.js';

@Module({
  controllers: [PacksController, AdminPacksController],
  providers: [PacksService, { provide: CNFT_TRANSFERRER, useClass: BubblegumTransferrer }],
  exports: [PacksService],
})
export class PacksModule {}
