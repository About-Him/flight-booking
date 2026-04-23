import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FlightStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlightsService } from './flights.service';

@Injectable()
export class FlightHorizonCron {
  private readonly logger = new Logger(FlightHorizonCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flightsService: FlightsService,
  ) {}

  @Cron('5 0 * * *')
  async extendRollingHorizon() {
    try {
      const schedules = await this.prisma.flightSchedule.findMany({
        where: { isDaily: true },
        include: { flight: true },
      });

      const horizonEnd = new Date();
      horizonEnd.setDate(horizonEnd.getDate() + 365);

      for (const schedule of schedules) {
        const last = await this.prisma.flightInstance.findFirst({
          where: { scheduleId: schedule.id },
          orderBy: { departureAt: 'desc' },
        });

        if (!last) {
          continue;
        }

        let nextDeparture = new Date(last.departureAt);
        nextDeparture.setDate(nextDeparture.getDate() + 1);
        const [hourStr, minStr] = schedule.departureTime.split(':');
        const hour = Number(hourStr);
        const minute = Number(minStr);
        nextDeparture.setHours(hour, minute, 0, 0);

        while (nextDeparture <= horizonEnd) {
          const arrivalAt = new Date(nextDeparture);
          arrivalAt.setMinutes(arrivalAt.getMinutes() + schedule.flight.durationMins);

          const y = nextDeparture.getFullYear();
          const m = String(nextDeparture.getMonth() + 1).padStart(2, '0');
          const d = String(nextDeparture.getDate()).padStart(2, '0');
          const hh = String(hour).padStart(2, '0');
          const mm = String(minute).padStart(2, '0');
          const instanceId = `${schedule.flight.flightNumber}-${y}${m}${d}-${hh}${mm}`;

          const created = await this.prisma.flightInstance.upsert({
            where: { instanceId },
            update: { departureAt: nextDeparture, arrivalAt, status: FlightStatus.SCHEDULED },
            create: {
              instanceId,
              flightId: schedule.flightId,
              scheduleId: schedule.id,
              departureAt: nextDeparture,
              arrivalAt,
              status: FlightStatus.SCHEDULED,
            },
          });

          await this.flightsService.ensureSeatsForInstance(created.id, schedule.flightId);
          await this.flightsService.syncInstanceToSearch(created.id);

          nextDeparture = new Date(nextDeparture);
          nextDeparture.setDate(nextDeparture.getDate() + 1);
          nextDeparture.setHours(hour, minute, 0, 0);
        }
      }
    } catch (error) {
      this.logger.warn(`Horizon cron skipped: ${(error as Error).message}`);
    }
  }
}
