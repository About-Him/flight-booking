import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { BookingsService } from '../bookings/bookings.service';
import { AdminService } from './admin.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('flights/:flightId')
  flightDetail(@Param('flightId') flightId: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.getFlightDetail(flightId, user);
  }

  @Post('flights/:flightId/staff')
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  addStaff(
    @Param('flightId') flightId: string,
    @Body() body: CreateStaffUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.addStaffForFlight(flightId, body, user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtPayload) {
    if (user.role === Role.SUPERADMIN) {
      return this.adminService.dashboardGlobal();
    }
    return this.adminService.dashboardForAirline(user.airlineId || '');
  }

  @Get('bookings')
  bookings(@CurrentUser() user: JwtPayload, @Query('query') query?: string) {
    if (user.role === Role.SUPERADMIN) {
      return this.adminService.allBookings(query);
    }
    return this.adminService.airlineBookings(user.airlineId || '', query);
  }

  @Post('bookings/:id/pass')
  @Roles(Role.ASSOCIATE, Role.SUPERADMIN)
  passToSenior(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.passToSenior(id, user);
  }

  @Post('bookings/:id/approve')
  @Roles(Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.approve(id, user);
  }

  @Post('bookings/:id/reject')
  @Roles(Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.reject(id, user);
  }
}
