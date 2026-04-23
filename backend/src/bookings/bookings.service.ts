import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role, SeatStatus } from '@prisma/client';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { PrismaReadService } from '../prisma/prisma-read.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';
import { InitiateBookingDto } from './dto/initiate-booking.dto';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type BookingEmailPayload = {
  id: string;
  totalAmount: { toString(): string } | number | string;
  instance: {
    instanceId: string;
    departureAt: Date;
    arrivalAt: Date;
    flight: {
      flightNumber: string;
      origin: string;
      destination: string;
      airline: { name: string };
    };
  };
  seats: Array<{ passengerName: string; seat: { seatNumber: string; class: string } }>;
};

@Injectable()
export class BookingsService {
  private redis?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaRead: PrismaReadService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private getRedis() {
    if (!this.redis) {
      this.redis = new Redis(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
    }
    return this.redis;
  }

  private lockKey(instanceId: string, seatId: string) {
    return `seat:lock:${instanceId}:${seatId}`;
  }

  private async assertAirlineAccess(airlineId: string, user: JwtPayload) {
    if (user.role === Role.SUPERADMIN) {
      return;
    }
    if (!user.airlineId || user.airlineId !== airlineId) {
      throw new ForbiddenException('Not allowed for this airline');
    }
  }

  private buildConfirmedBookingEmailHtml(b: BookingEmailPayload): string {
    const total = Number(b.totalAmount);
    const dep = new Date(b.instance.departureAt).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const arr = new Date(b.instance.arrivalAt).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const rows = b.seats
      .map(
        (s) =>
          `<tr><td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(s.passengerName)}</td>` +
          `<td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(s.seat.seatNumber)}</td>` +
          `<td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(s.seat.class)}</td></tr>`,
      )
      .join('');

    return `
<p>Your booking has been <strong>confirmed</strong>. Here are the details:</p>
<table style="border-collapse:collapse;margin:12px 0;max-width:560px;font-family:system-ui,sans-serif;font-size:14px;">
  <tr><td style="padding:6px 0;color:#64748b;">Booking reference</td><td style="padding:6px 0;"><strong>${escapeHtml(b.id)}</strong></td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Airline</td><td style="padding:6px 0;">${escapeHtml(b.instance.flight.airline.name)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Flight</td><td style="padding:6px 0;">${escapeHtml(b.instance.flight.flightNumber)} · ${escapeHtml(b.instance.flight.origin)} → ${escapeHtml(b.instance.flight.destination)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Departure</td><td style="padding:6px 0;">${escapeHtml(dep)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Arrival</td><td style="padding:6px 0;">${escapeHtml(arr)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Itinerary id</td><td style="padding:6px 0;">${escapeHtml(b.instance.instanceId)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Total</td><td style="padding:6px 0;"><strong>${Number.isFinite(total) ? total.toFixed(2) : escapeHtml(String(b.totalAmount))}</strong></td></tr>
</table>
<p style="font-family:system-ui,sans-serif;font-size:14px;">Passengers &amp; seats</p>
<table style="border-collapse:collapse;margin:0 0 16px;max-width:560px;font-family:system-ui,sans-serif;font-size:14px;">
  <thead><tr style="background:#f1f5f9;"><th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Passenger</th><th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Seat</th><th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Class</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p style="font-family:system-ui,sans-serif;font-size:13px;color:#64748b;">Keep this email for your records. You can view bookings anytime after signing in.</p>
`.trim();
  }

  private buildRejectedBookingEmailHtml(b: BookingEmailPayload, refunded: boolean): string {
    const dep = new Date(b.instance.departureAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const rows = b.seats
      .map(
        (s) =>
          `<tr><td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(s.passengerName)}</td>` +
          `<td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(s.seat.seatNumber)}</td></tr>`,
      )
      .join('');
    const outcome = refunded
      ? 'Refunded where payment applied. Funds should return per your card issuer.'
      : 'Rejected. No charge was completed for this itinerary.';

    return `
<p>Your booking request was <strong>${refunded ? 'refunded' : 'rejected'}</strong>.</p>
<p style="font-family:system-ui,sans-serif;font-size:14px;">${outcome}</p>
<table style="border-collapse:collapse;margin:12px 0;max-width:560px;font-family:system-ui,sans-serif;font-size:14px;">
  <tr><td style="padding:6px 0;color:#64748b;">Booking reference</td><td style="padding:6px 0;"><strong>${escapeHtml(b.id)}</strong></td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Flight</td><td style="padding:6px 0;">${escapeHtml(b.instance.flight.flightNumber)} · ${escapeHtml(b.instance.flight.origin)} → ${escapeHtml(b.instance.flight.destination)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Airline</td><td style="padding:6px 0;">${escapeHtml(b.instance.flight.airline.name)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Scheduled departure</td><td style="padding:6px 0;">${escapeHtml(dep)}</td></tr>
</table>
<p style="font-family:system-ui,sans-serif;font-size:14px;">Requested seats</p>
<table style="border-collapse:collapse;margin:0 0 16px;max-width:560px;font-family:system-ui,sans-serif;font-size:14px;">
  <thead><tr style="background:#f1f5f9;"><th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Passenger</th><th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Seat</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
`.trim();
  }

  private async loadBookingForWorkflow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        instance: { include: { flight: { include: { airline: true } } } },
        seats: { include: { seat: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async initiate(userId: string, dto: InitiateBookingDto) {
    if (dto.passengerNames.length !== dto.seatIds.length) {
      throw new BadRequestException('passengerNames must align with seatIds');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!actor) {
      throw new UnauthorizedException(
        'Your session refers to a user that no longer exists (for example after a database reset). Please sign out and sign in again.',
      );
    }

    const flightInstance = await this.prisma.flightInstance.findFirst({
      where: { OR: [{ id: dto.instanceId }, { instanceId: dto.instanceId }] },
      select: { id: true },
    });
    if (!flightInstance) {
      throw new NotFoundException('Flight instance not found');
    }
    const instanceDbId = flightInstance.id;

    const seats = await this.prisma.seat.findMany({
      where: {
        id: { in: dto.seatIds },
        instanceId: instanceDbId,
      },
    });

    if (seats.length !== dto.seatIds.length) {
      throw new NotFoundException('One or more seats were not found');
    }

    const lockedKeys: string[] = [];
    for (const seat of seats) {
      if (seat.status === SeatStatus.BOOKED) {
        throw new BadRequestException(`Seat ${seat.seatNumber} is already booked`);
      }

      const key = this.lockKey(instanceDbId, seat.id);
      const lock = await this.getRedis().set(key, userId, 'EX', 900, 'NX');
      if (!lock) {
        for (const k of lockedKeys) {
          await this.getRedis().del(k);
        }
        throw new BadRequestException(`Seat ${seat.seatNumber} is currently locked`);
      }
      lockedKeys.push(key);
    }

    const totalAmount = seats.reduce((sum, seat) => sum + Number(seat.basePrice), 0);

    let booking;
    try {
      booking = await this.prisma.booking.create({
        data: {
          userId,
          instanceId: instanceDbId,
          totalAmount,
          status: BookingStatus.PENDING_PAYMENT,
          seats: {
            create: seats.map((seat, index) => ({
              seatId: seat.id,
              passengerName: dto.passengerNames[index],
            })),
          },
        },
        include: {
          seats: true,
        },
      });
    } catch (err) {
      for (const k of lockedKeys) {
        await this.getRedis().del(k);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new UnauthorizedException(
          'Could not create booking for this account. Please sign out and sign in again.',
        );
      }
      throw err;
    }

    await this.prisma.seat.updateMany({
      where: { id: { in: dto.seatIds } },
      data: { status: SeatStatus.LOCKED },
    });

    return { booking, seatLocks: lockedKeys };
  }

  async myBookings(userId: string) {
    return this.prismaRead.booking.findMany({
      where: { userId },
      include: {
        instance: {
          include: {
            flight: { include: { airline: true } },
          },
        },
        seats: { include: { seat: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async passToSenior(bookingId: string, user: JwtPayload) {
    if (user.role !== Role.ASSOCIATE && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only associates can pass bookings to senior review');
    }

    const booking = await this.loadBookingForWorkflow(bookingId);

    if (booking.status !== BookingStatus.PENDING_VALIDATION) {
      throw new BadRequestException('Booking is not awaiting associate validation');
    }

    await this.assertAirlineAccess(booking.instance.flight.airlineId, user);

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.PENDING_APPROVAL },
    });
  }

  async approve(bookingId: string, user: JwtPayload) {
    if (user.role !== Role.SENIOR_ASSOCIATE && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only senior associates can approve bookings');
    }

    const booking = await this.loadBookingForWorkflow(bookingId);

    if (booking.status !== BookingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Booking is not awaiting senior approval');
    }

    await this.assertAirlineAccess(booking.instance.flight.airlineId, user);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
      include: {
        user: true,
        seats: { include: { seat: true } },
        instance: { include: { flight: { include: { airline: true } } } },
      },
    });

    await this.prisma.seat.updateMany({
      where: { id: { in: updated.seats.map((seat) => seat.seatId) } },
      data: { status: SeatStatus.BOOKED },
    });

    for (const seat of updated.seats) {
      await this.getRedis().del(this.lockKey(updated.instanceId, seat.seatId));
    }

    const html = this.buildConfirmedBookingEmailHtml(updated as BookingEmailPayload);
    await this.emailService.sendBookingStatusEmail(updated.user.email, 'Booking confirmed', html, updated.id);

    return updated;
  }

  async reject(bookingId: string, user: JwtPayload) {
    if (user.role !== Role.SENIOR_ASSOCIATE && user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only senior associates can reject bookings');
    }

    const booking = await this.loadBookingForWorkflow(bookingId);

    if (booking.status !== BookingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Booking is not awaiting senior approval');
    }

    await this.assertAirlineAccess(booking.instance.flight.airlineId, user);

    if (booking.stripePaymentIntentId) {
      await this.paymentsService.refundPaymentIntent(booking.stripePaymentIntentId);
    }

    const nextStatus = booking.stripePaymentIntentId ? BookingStatus.REFUNDED : BookingStatus.REJECTED;

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: nextStatus },
      include: { user: true, seats: true },
    });

    await this.prisma.seat.updateMany({
      where: { id: { in: updated.seats.map((seat) => seat.seatId) } },
      data: { status: SeatStatus.AVAILABLE },
    });

    for (const seat of updated.seats) {
      await this.getRedis().del(this.lockKey(booking.instanceId, seat.seatId));
    }

    const html = this.buildRejectedBookingEmailHtml(
      booking as BookingEmailPayload,
      nextStatus === BookingStatus.REFUNDED,
    );
    await this.emailService.sendBookingStatusEmail(
      updated.user.email,
      nextStatus === BookingStatus.REFUNDED ? 'Booking refunded' : 'Booking rejected',
      html,
      updated.id,
    );

    return updated;
  }
}
