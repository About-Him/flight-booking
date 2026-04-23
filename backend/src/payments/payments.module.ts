import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsWebhookController } from './payments-webhook.controller';

@Module({
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsWebhookController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
