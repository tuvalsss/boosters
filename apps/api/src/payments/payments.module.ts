import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { AdminPaymentsController, PaymentsController } from './payments.controller.js';

@Module({
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
