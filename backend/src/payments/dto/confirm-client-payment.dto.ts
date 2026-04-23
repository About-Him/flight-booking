import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Body for temporary client-triggered sync after Stripe.js reports success (dev / until webhooks are reliable). */
export class ConfirmClientPaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingId!: string;

  /** The PaymentIntent `id` returned by `stripe.confirmPayment` (avoids DB pointing at a newer unused PI). */
  @IsOptional()
  @IsString()
  paymentIntentId?: string;
}
