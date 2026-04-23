import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { PrismaReadService } from '../prisma/prisma-read.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStaffUserDto } from './dto/create-staff-user.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prisma: PrismaService,
  ) {}

  private assertCanAccessFlightAirline(flight: { airlineId: string }, user: JwtPayload) {
    if (user.role === Role.SUPERADMIN) {
      return;
    }
    if (!user.airlineId || user.airlineId !== flight.airlineId) {
      throw new ForbiddenException('You cannot access this flight');
    }
  }

  async getFlightDetail(flightId: string, user: JwtPayload) {
    const flight = await this.prismaRead.flight.findUnique({
      where: { id: flightId },
      include: {
        airline: true,
        _count: { select: { instances: true, schedules: true } },
      },
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    this.assertCanAccessFlightAirline(flight, user);

    const staff = await this.prismaRead.user.findMany({
      where: { airlineId: flight.airlineId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { email: 'asc' },
    });

    return { flight, staff };
  }

  async addStaffForFlight(flightId: string, dto: CreateStaffUserDto, actingUser: JwtPayload) {
    const flight = await this.prisma.flight.findUnique({
      where: { id: flightId },
      select: { id: true, airlineId: true, flightNumber: true },
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    this.assertCanAccessFlightAirline(flight, actingUser);

    if (actingUser.role === Role.ASSOCIATE && dto.role !== 'ASSOCIATE') {
      throw new ForbiddenException('Associates can only add associate accounts');
    }
    if (actingUser.role === Role.SENIOR_ASSOCIATE && dto.role === 'SENIOR_ASSOCIATE') {
      throw new ForbiddenException('Only a superadmin can create another senior associate');
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('That email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = dto.role === 'SENIOR_ASSOCIATE' ? Role.SENIOR_ASSOCIATE : Role.ASSOCIATE;
    const created = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        role,
        airlineId: flight.airlineId,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return created;
  }

  async dashboardForAirline(airlineId: string) {
    const [flights, pendingValidation, pendingApproval] = await Promise.all([
      this.prismaRead.flight.count({ where: { airlineId } }),
      this.prismaRead.booking.count({
        where: {
          status: BookingStatus.PENDING_VALIDATION,
          instance: { flight: { airlineId } },
        },
      }),
      this.prismaRead.booking.count({
        where: {
          status: BookingStatus.PENDING_APPROVAL,
          instance: { flight: { airlineId } },
        },
      }),
    ]);

    return { flights, pendingValidation, pendingApproval };
  }

  async dashboardGlobal() {
    const [flights, pendingValidation, pendingApproval] = await Promise.all([
      this.prismaRead.flight.count(),
      this.prismaRead.booking.count({ where: { status: BookingStatus.PENDING_VALIDATION } }),
      this.prismaRead.booking.count({ where: { status: BookingStatus.PENDING_APPROVAL } }),
    ]);

    return { flights, pendingValidation, pendingApproval };
  }

  async airlineBookings(airlineId: string, query?: string) {
    return this.prismaRead.booking.findMany({
      where: {
        instance: { flight: { airlineId } },
        ...(query
          ? {
              user: {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        user: true,
        instance: { include: { flight: { include: { airline: true } } } },
        seats: { include: { seat: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async allBookings(query?: string) {
    return this.prismaRead.booking.findMany({
      where: query
        ? {
            user: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
          }
        : {},
      include: {
        user: true,
        instance: { include: { flight: { include: { airline: true } } } },
        seats: { include: { seat: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
