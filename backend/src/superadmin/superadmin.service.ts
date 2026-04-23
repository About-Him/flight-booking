import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAirlineDto } from './dto/create-airline.dto';

@Injectable()
export class SuperadminService {
  constructor(private readonly prisma: PrismaService) {}

  listAirlines() {
    return this.prisma.airline.findMany({
      include: {
        _count: {
          select: {
            flights: true,
            staff: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createAirline(data: CreateAirlineDto) {
    const code = data.code.trim().toUpperCase();
    const email = data.seniorAssociateEmail.trim().toLowerCase();

    const [existingUser, existingCode] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.airline.findUnique({ where: { code } }),
    ]);

    if (existingUser) {
      throw new BadRequestException('That email is already registered');
    }
    if (existingCode) {
      throw new BadRequestException('Airline code is already in use');
    }

    const displayName =
      data.seniorAssociateName?.trim() || `${data.name.trim()} Senior Associate`;
    const passwordHash = await bcrypt.hash(data.seniorAssociatePassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const airline = await tx.airline.create({
        data: {
          name: data.name.trim(),
          code,
          logoUrl: data.logoUrl?.trim() || undefined,
        },
      });

      const seniorAssociate = await tx.user.create({
        data: {
          email,
          name: displayName,
          passwordHash,
          role: Role.SENIOR_ASSOCIATE,
          airlineId: airline.id,
        },
        select: { id: true, email: true, name: true, role: true },
      });

      return { airline, seniorAssociate };
    });
  }

  async createAirlineUser(
    airlineId: string,
    data: { email: string; name: string; password: string; role: Role },
  ) {
    if (data.role !== Role.ASSOCIATE && data.role !== Role.SENIOR_ASSOCIATE) {
      throw new BadRequestException('Role must be ASSOCIATE or SENIOR_ASSOCIATE');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: data.role,
        airlineId,
      },
    });
  }

  updateAirlineUserRole(airlineId: string, userId: string, role: Role) {
    return this.prisma.user.updateMany({
      where: { id: userId, airlineId },
      data: { role },
    });
  }

  removeAirlineUser(airlineId: string, userId: string) {
    return this.prisma.user.updateMany({
      where: { id: userId, airlineId },
      data: { airlineId: null, role: Role.USER },
    });
  }
}
