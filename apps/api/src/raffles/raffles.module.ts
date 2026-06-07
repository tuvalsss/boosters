import { Module } from '@nestjs/common';
import { RafflesService } from './raffles.service.js';
import { AdminRafflesController, RafflesController } from './raffles.controller.js';
import { BubblegumTransferrer } from '../marketplace/bubblegum.transferrer.js';
import { CNFT_TRANSFERRER } from '../marketplace/cnft-transferrer.js';

@Module({
  controllers: [RafflesController, AdminRafflesController],
  providers: [RafflesService, { provide: CNFT_TRANSFERRER, useClass: BubblegumTransferrer }],
  exports: [RafflesService],
})
export class RafflesModule {}
