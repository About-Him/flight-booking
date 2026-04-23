import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { ConfirmClientPaymentDto } from './dto/confirm-client-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  createIntent(@CurrentUser() user: JwtPayload, @Body() body: { bookingId: string }) {
    return this.paymentsService.createIntent(body.bookingId, user.sub);
  }

  /** TEMP: sync booking to PENDING_VALIDATION after Stripe.js success (see PaymentsService). */
  @Post('confirm-client-success')
  confirmClientSuccess(@CurrentUser() user: JwtPayload, @Body() body: ConfirmClientPaymentDto) {
    return this.paymentsService.confirmAfterClientStripeSuccess(
      body.bookingId,
      user.sub,
      body.paymentIntentId,
    );
  }
}
