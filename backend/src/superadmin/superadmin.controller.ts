import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { SuperadminService } from './superadmin.service';

@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('airlines')
  listAirlines() {
    return this.superadminService.listAirlines();
  }

  @Post('airlines')
  createAirline(@Body() body: CreateAirlineDto) {
    return this.superadminService.createAirline(body);
  }

  @Post('airlines/:id/users')
  createAirlineUser(
    @Param('id') airlineId: string,
    @Body() body: { email: string; name: string; password: string; role: Role },
  ) {
    return this.superadminService.createAirlineUser(airlineId, body);
  }

  @Put('airlines/:id/users/:userId')
  updateUserRole(
    @Param('id') airlineId: string,
    @Param('userId') userId: string,
    @Body() body: { role: Role },
  ) {
    return this.superadminService.updateAirlineUserRole(airlineId, userId, body.role);
  }

  @Delete('airlines/:id/users/:userId')
  removeUser(@Param('id') airlineId: string, @Param('userId') userId: string) {
    return this.superadminService.removeAirlineUser(airlineId, userId);
  }
}
