import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FlightStatus, Prisma, Role, SeatStatus } from '@prisma/client';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { PrismaReadService } from '../prisma/prisma-read.service';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { defaultSeatRowsForInstance, MIN_SEAT_COUNT_TO_USE_AS_TEMPLATE } from './default-seat-layout';

/** Prisma client or interactive transaction client (same model delegates). */
type DbExec = Pick<PrismaService, 'seat' | 'flightInstance'>;

@Injectable()
export class FlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaRead: PrismaReadService,
    private readonly es: ElasticsearchService,
  ) {}

  private parsePagination(pageStr?: string, pageSizeStr?: string) {
    const rawSize = parseInt(pageSizeStr ?? '', 10);
    const pageSize = Number.isFinite(rawSize) ? Math.min(Math.max(rawSize, 1), 100) : 20;
    const rawPage = parseInt(pageStr ?? '', 10);
    const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;
    return { page, pageSize, skip: (page - 1) * pageSize };
  }

  private toPaginated<T>(items: T[], total: number, page: number, pageSize: number) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    return { items, total, page, pageSize, totalPages };
  }

  private docFromInstanceForSearch(inst: {
    id: string;
    instanceId: string;
    flightId: string;
    departureAt: Date;
    arrivalAt: Date;
    status: string;
    flight: {
      airlineId: string;
      flightNumber: string;
      origin: string;
      destination: string;
      airline: { name: string };
    };
  }) {
    return {
      id: inst.id,
      instanceId: inst.instanceId,
      flightId: inst.flightId,
      airlineId: inst.flight.airlineId,
      airlineName: inst.flight.airline.name,
      flightNumber: inst.flight.flightNumber,
      origin: inst.flight.origin.toUpperCase(),
      destination: inst.flight.destination.toUpperCase(),
      departureAt: inst.departureAt,
      arrivalAt: inst.arrivalAt,
      status: inst.status,
    };
  }

  /** Index one instance for flight search (Elasticsearch). */
  async syncInstanceToSearch(instanceDbId: string) {
    const inst = await this.prisma.flightInstance.findUnique({
      where: { id: instanceDbId },
      include: { flight: { include: { airline: true } } },
    });
    if (!inst) {
      return;
    }
    await this.es.indexFlightInstance(this.docFromInstanceForSearch(inst));
  }

  private async syncScheduleInstancesToSearch(scheduleId: string) {
    const rows = await this.prisma.flightInstance.findMany({
      where: { scheduleId },
      include: { flight: { include: { airline: true } } },
    });
    for (const inst of rows) {
      await this.es.indexFlightInstance(this.docFromInstanceForSearch(inst));
    }
  }

  async search(dto: SearchFlightsDto) {
    const outbound = await this.es.searchOneWay(dto.origin, dto.destination, dto.date);
    if (dto.type === 'one-way') {
      return outbound;
    }

    if (!dto.returnDate) {
      throw new BadRequestException('returnDate is required for round-trip search');
    }

    const inbound = await this.es.searchOneWay(dto.destination, dto.origin, dto.returnDate);
    return { outbound, return: inbound };
  }
  async removeFlightInstance(flightInstanceId: string, user: JwtPayload) {
    const instance = await this.prisma.flightInstance.findFirst({
      where: {
        OR: [{ id: flightInstanceId }, { instanceId: flightInstanceId }],
      },
      include: {
        flight: true,
        _count: { select: { bookings: true } },
      },
    });
    if (!instance) {
      throw new NotFoundException('Flight instance not found');
    }

    this.assertStaffOwnsFlight(instance.flight, user);

    if (instance._count.bookings > 0) {
      throw new BadRequestException(
        'Cannot delete a flight instance that has bookings; cancel or complete those bookings first.',
      );
    }

    const dbId = instance.id;
    await this.prisma.$transaction(async (tx) => {
      await tx.seat.deleteMany({ where: { instanceId: dbId } });
      await tx.flightInstance.delete({ where: { id: dbId } });
    });

    await this.es.deleteFlightInstance(dbId);

    return { message: 'Flight instance removed successfully' };
  }
  async findById(flightInstanceId: string) {
    // Use primary DB: search hits come from ES (indexed from primary); read replica may be empty or lagging.
    const instance = await this.prisma.flightInstance.findFirst({
      where: {
        OR: [{ id: flightInstanceId }, { instanceId: flightInstanceId }],
      },
      include: {
        flight: { include: { airline: true } },
        seats: { orderBy: { seatNumber: 'asc' } },
      },
    });

    if (!instance) {
      throw new NotFoundException('Flight instance not found');
    }

    return {
      id: instance.id,
      instanceId: instance.instanceId,
      flightNumber: instance.flight.flightNumber,
      origin: instance.flight.origin,
      destination: instance.flight.destination,
      departureAt: instance.departureAt,
      arrivalAt: instance.arrivalAt,
      status: instance.status,
      airlineName: instance.flight.airline.name,
      seats: instance.seats,
    };
  }

  async listTemplatesForStaff(user: JwtPayload) {
    if (user.role === Role.SUPERADMIN) {
      return this.prismaRead.flight.findMany({
        include: {
          airline: true,
          _count: { select: { schedules: true, instances: true } },
        },
        orderBy: [{ airline: { name: 'asc' } }, { flightNumber: 'asc' }],
      });
    }

    if (!user.airlineId) {
      return [];
    }

    return this.prismaRead.flight.findMany({
      where: { airlineId: user.airlineId },
      include: {
        airline: true,
        _count: { select: { schedules: true, instances: true } },
      },
      orderBy: { flightNumber: 'asc' },
    });
  }

  private assertStaffOwnsFlight(flight: { airlineId: string }, user: JwtPayload) {
    if (user.role === Role.SUPERADMIN) {
      return;
    }
    if (!user.airlineId || user.airlineId !== flight.airlineId) {
      throw new ForbiddenException('You cannot manage flights for this airline');
    }
    if (user.role !== Role.ASSOCIATE && user.role !== Role.SENIOR_ASSOCIATE) {
      throw new ForbiddenException();
    }
  }

  async createFlightTemplate(
    data: {
      airlineId: string;
      flightNumber: string;
      origin: string;
      destination: string;
      durationMins: number;
    },
    user: JwtPayload,
  ) {
    const airline = await this.prisma.airline.findUnique({ where: { id: data.airlineId } });
    if (!airline) {
      throw new NotFoundException('Airline not found');
    }

    this.assertStaffOwnsFlight({ airlineId: data.airlineId }, user);

    const origin = data.origin.toUpperCase();
    const destination = data.destination.toUpperCase();
    if (origin === destination) {
      throw new BadRequestException('Origin and destination must differ');
    }

    return this.prisma.flight.create({
      data: {
        airlineId: data.airlineId,
        flightNumber: data.flightNumber.trim(),
        origin,
        destination,
        durationMins: data.durationMins,
      },
      include: { airline: true },
    });
  }

  /**
   * Parses `departureTime` into hour/minute (24h). Accepts `H:mm` or `HH:mm`.
   */
  private parseDepartureTime(departureTime: string): { hour: number; minute: number; normalized: string } {
    const trimmed = departureTime.trim();
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
    if (!match) {
      throw new BadRequestException('departureTime must be HH:mm (24h)');
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const normalized = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { hour, minute, normalized };
  }

  /**
   * Idempotent seat rows for a flight instance. Works inside or outside a transaction.
   */
  private async attachSeatsToInstance(db: DbExec, instanceDbId: string, flightId: string) {
    const existing = await db.seat.count({ where: { instanceId: instanceDbId } });
    if (existing > 0) {
      return;
    }

    const templateInstance = await db.flightInstance.findFirst({
      where: {
        flightId,
        id: { not: instanceDbId },
        seats: { some: {} },
      },
      orderBy: { departureAt: 'desc' },
      include: { seats: true },
    });

    if (
      templateInstance &&
      templateInstance.seats.length >= MIN_SEAT_COUNT_TO_USE_AS_TEMPLATE
    ) {
      await db.seat.createMany({
        data: templateInstance.seats.map(
          (seat): Prisma.SeatCreateManyInput => ({
            instanceId: instanceDbId,
            seatNumber: seat.seatNumber,
            class: seat.class,
            basePrice: seat.basePrice,
            status: SeatStatus.AVAILABLE,
          }),
        ),
      });
      return;
    }

    await db.seat.createMany({ data: defaultSeatRowsForInstance(instanceDbId) });
  }

  /** Used by cron; uses the default Prisma client (no enclosing transaction). */
  async ensureSeatsForInstance(instanceDbId: string, flightId: string) {
    await this.attachSeatsToInstance(this.prisma, instanceDbId, flightId);
  }

  /**
   * Creates a `FlightSchedule` and materializes `FlightInstance` rows (1 for one-off, 364 for daily).
   * Daily: rolling horizon day 365 is added by the midnight cron. All writes are atomic.
   */
  async createSchedule(
    data: {
      flightId: string;
      departureTime: string;
      scheduledDate: string;
      isDaily: boolean;
      createdById?: string;
    },
    user: JwtPayload,
  ) {
    const flight = await this.prisma.flight.findUnique({ where: { id: data.flightId } });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }

    this.assertStaffOwnsFlight(flight, user);

    const scheduledDate = new Date(data.scheduledDate);
    if (Number.isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('scheduledDate is invalid');
    }

    const { hour, minute, normalized } = this.parseDepartureTime(data.departureTime);
    const dayCount = data.isDaily ? 364 : 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.flightSchedule.create({
        data: {
          flightId: data.flightId,
          departureTime: normalized,
          scheduledDate,
          isDaily: data.isDaily,
          createdById: data.createdById,
        },
        include: { flight: true },
      });

      let generated = 0;
      for (let i = 0; i < dayCount; i += 1) {
        const departureAt = new Date(schedule.scheduledDate);
        departureAt.setDate(departureAt.getDate() + i);
        departureAt.setHours(hour, minute, 0, 0);

        const arrivalAt = new Date(departureAt);
        arrivalAt.setMinutes(arrivalAt.getMinutes() + schedule.flight.durationMins);

        const y = departureAt.getFullYear();
        const m = String(departureAt.getMonth() + 1).padStart(2, '0');
        const d = String(departureAt.getDate()).padStart(2, '0');
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        const instanceId = `${schedule.flight.flightNumber}-${y}${m}${d}-${hh}${mm}`;

        const inst = await tx.flightInstance.upsert({
          where: { instanceId },
          update: {
            departureAt,
            arrivalAt,
            status: FlightStatus.SCHEDULED,
            scheduleId: schedule.id,
            flightId: schedule.flightId,
          },
          create: {
            instanceId,
            flightId: schedule.flightId,
            scheduleId: schedule.id,
            departureAt,
            arrivalAt,
            status: FlightStatus.SCHEDULED,
          },
        });

        await this.attachSeatsToInstance(tx, inst.id, schedule.flightId);
        generated += 1;
      }

      return { scheduleId: schedule.id, instancesGenerated: generated };
    });

    await this.syncScheduleInstancesToSearch(result.scheduleId);

    return result;
  }

  async listInstancesForFlight(flightId: string, user: JwtPayload, pageStr?: string, pageSizeStr?: string) {
    const flight = await this.prismaRead.flight.findUnique({ where: { id: flightId } });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    this.assertStaffOwnsFlight(flight, user);

    const { page, pageSize, skip } = this.parsePagination(pageStr, pageSizeStr);
    const include = {
      schedule: true,
      seats: { select: { id: true, seatNumber: true, status: true, class: true } },
    };

    const where = { flightId };

    const [items, total] = await Promise.all([
      this.prismaRead.flightInstance.findMany({
        where,
        orderBy: { departureAt: 'asc' },
        skip,
        take: pageSize,
        include,
      }),
      this.prismaRead.flightInstance.count({ where }),
    ]);

    return this.toPaginated(items, total, page, pageSize);
  }

  /**
   * Next upcoming SCHEDULED legs for all routes the user may manage (no flight filter in UI).
   * Superadmin: all airlines; associate/senior: their airline only.
   */
  async listUpcomingInstancesForStaff(user: JwtPayload, pageStr?: string, pageSizeStr?: string) {
    const { page, pageSize, skip } = this.parsePagination(pageStr, pageSizeStr);
    const now = new Date();

    if (user.role !== Role.SUPERADMIN) {
      if (user.role !== Role.ASSOCIATE && user.role !== Role.SENIOR_ASSOCIATE) {
        throw new ForbiddenException();
      }
      if (!user.airlineId) {
        return this.toPaginated([], 0, page, pageSize);
      }
    }

    const where: Prisma.FlightInstanceWhereInput =
      user.role === Role.SUPERADMIN
        ? {
            departureAt: { gte: now },
            status: FlightStatus.SCHEDULED,
          }
        : {
            departureAt: { gte: now },
            status: FlightStatus.SCHEDULED,
            flight: { airlineId: user.airlineId! },
          };

    const include = {
      flight: { include: { airline: true } },
      schedule: true,
      seats: { select: { id: true, seatNumber: true, status: true, class: true } },
    };

    const [items, total] = await Promise.all([
      this.prismaRead.flightInstance.findMany({
        where,
        orderBy: { departureAt: 'asc' },
        skip,
        take: pageSize,
        include,
      }),
      this.prismaRead.flightInstance.count({ where }),
    ]);

    return this.toPaginated(items, total, page, pageSize);
  }
}
