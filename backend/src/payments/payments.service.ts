import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, SeatStatus } from '@prisma/client';
import Redis from 'ioredis';
import StripeConstructor from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

type StripeClient = InstanceType<typeof StripeConstructor>;

type StripePaymentIntentLike = {
  id: string;
  metadata?: Record<string, string> | null;
};

@Injectable()
export class PaymentsService {
  private readonly stripeClient: StripeClient;
  private redis?: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripeClient = new StripeConstructor(this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_dummy', {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  private getRedis() {
    if (!this.redis) {
      this.redis = new Redis(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
    }
    return this.redis;
  }

  private lockKey(instanceId: string, seatId: string) {
    return `seat:lock:${instanceId}:${seatId}`;
  }

  private static readonly REUSABLE_PI_STATUSES = new Set([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
  ]);

  async createIntent(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException();
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Booking is not awaiting payment');
    }

    const amount = Math.round(Number(booking.totalAmount) * 100);

    if (booking.stripePaymentIntentId) {
      const existing = await this.stripeClient.paymentIntents.retrieve(booking.stripePaymentIntentId);
      if (existing.metadata?.bookingId === bookingId && existing.amount === amount) {
        if (existing.status === 'succeeded') {
          await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
              status: BookingStatus.PENDING_VALIDATION,
              stripePaymentIntentId: existing.id,
            },
          });
          throw new BadRequestException('Payment already completed for this booking');
        }
        if (PaymentsService.REUSABLE_PI_STATUSES.has(existing.status) && existing.client_secret) {
          return {
            clientSecret: existing.client_secret,
            paymentIntentId: existing.id,
          };
        }
      }
    }

    const intent = await this.stripeClient.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: { bookingId },
      automatic_payment_methods: { enabled: true },
    });

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { stripePaymentIntentId: intent.id },
    });

    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  async refundPaymentIntent(paymentIntentId: string) {
    try {
      await this.stripeClient.refunds.create({ payment_intent: paymentIntentId });
    } catch {
      // Stripe throws if nothing to refund; ignore for idempotency
    }
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      return;
    }

    let event: ReturnType<StripeClient['webhooks']['constructEvent']>;
    try {
      event = this.stripeClient.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      return;
    }

    if (event.type === 'payment_intent.succeeded') {
      await this.onPaymentSucceeded(event.data.object as StripePaymentIntentLike);
    } else if (event.type === 'payment_intent.payment_failed') {
      await this.onPaymentFailed(event.data.object as StripePaymentIntentLike);
    }
  }

  private async onPaymentSucceeded(pi: StripePaymentIntentLike) {
    const bookingId = pi.metadata?.bookingId;
    if (!bookingId) {
      return;
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking || booking.status !== BookingStatus.PENDING_PAYMENT) {
      return;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.PENDING_VALIDATION,
        stripePaymentIntentId: pi.id,
      },
    });
  }

  /**
   * TEMP: Call from the browser after `stripe.confirmPayment` reports `succeeded`, when webhooks
   * are not reaching the server (e.g. local dev). Verifies status with Stripe before updating DB.
   */
  async confirmAfterClientStripeSuccess(bookingId: string, userId: string, clientPaymentIntentId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { seats: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException();
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      return { ok: true, status: booking.status, message: 'Booking was already updated' };
    }

    const piId = clientPaymentIntentId?.trim() || booking.stripePaymentIntentId;
    if (!piId) {
      throw new BadRequestException('No payment intent for this booking');
    }

    const pi = await this.stripeClient.paymentIntents.retrieve(piId);
    if (pi.metadata?.bookingId !== bookingId) {
      throw new BadRequestException('Payment intent does not belong to this booking');
    }
    if (pi.status !== 'succeeded') {
      throw new BadRequestException(
        `Stripe payment status is ${pi.status}, not succeeded. If you saw success in the UI, pass paymentIntentId from confirmPayment (avoids a duplicate create-intent overwriting the paid intent).`,
      );
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.PENDING_VALIDATION,
        stripePaymentIntentId: pi.id,
      },
    });

    return { ok: true, status: BookingStatus.PENDING_VALIDATION };
  }

  private async onPaymentFailed(pi: StripePaymentIntentLike) {
    const booking = await this.prisma.booking.findFirst({
      where: { stripePaymentIntentId: pi.id },
      include: { seats: true },
    });
    if (!booking || booking.status !== BookingStatus.PENDING_PAYMENT) {
      return;
    }

    const seatIds = booking.seats.map((row) => row.seatId);

    await this.prisma.$transaction(async (tx) => {
      await tx.bookingSeat.deleteMany({ where: { bookingId: booking.id } });
      await tx.booking.delete({ where: { id: booking.id } });
      await tx.seat.updateMany({
        where: { id: { in: seatIds } },
        data: { status: SeatStatus.AVAILABLE },
      });
    });

    for (const row of booking.seats) {
      await this.getRedis().del(this.lockKey(booking.instanceId, row.seatId));
    }
  }
}
