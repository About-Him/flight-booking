import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async getEligibility(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { instance: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const now = new Date();
    const departure = booking.instance.departureAt;
    const diffHours = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);

    return {
      canCheckIn: diffHours <= 47 && diffHours >= 2 && booking.status === BookingStatus.CONFIRMED,
      departureAt: departure,
      status: booking.status,
    };
  }

  async checkIn(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { user: true, seats: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new BadRequestException('Already checked in');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_IN },
      });

      await tx.bookingSeat.updateMany({
        where: { bookingId },
        data: { checkedIn: true, checkedInAt: new Date() },
      });

      await tx.checkIn.upsert({
        where: { bookingId },
        update: { checkedInAt: new Date() },
        create: {
          bookingId,
          boardingPassRef: `BP-${Date.now()}-${bookingId.slice(0, 6)}`,
        },
      });
    });

    await this.emailService.sendBookingStatusEmail(
      booking.user.email,
      'Check-in completed',
      `<p>Your web check-in is complete for booking ${bookingId}.</p>`,
      bookingId,
    );

    return { checkedIn: true, bookingId };
  }
}
