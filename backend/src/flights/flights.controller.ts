import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { CreateFlightTemplateDto } from './dto/create-flight-template.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlightsService } from './flights.service';

@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  search(@Query() query: SearchFlightsDto) {
    return this.flightsService.search(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  @Get('templates')
  listTemplates(@CurrentUser() user: JwtPayload) {
    return this.flightsService.listTemplatesForStaff(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  @Get('templates/:flightId/instances')
  listInstances(
    @Param('flightId') flightId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.flightsService.listInstancesForFlight(flightId, user, page, pageSize);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  @Get('instances/upcoming')
  listUpcomingInstances(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.flightsService.listUpcomingInstancesForStaff(user, page, pageSize);
  }

  @Get(':flightInstanceId')
  findById(@Param('flightInstanceId') flightInstanceId: string) {
    return this.flightsService.findById(flightInstanceId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  @Post()
  createFlightTemplate(@Body() body: CreateFlightTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.flightsService.createFlightTemplate(body, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  @Post('schedule')
  createSchedule(@Body() body: CreateScheduleDto, @CurrentUser() user: JwtPayload) {
    return this.flightsService.createSchedule({ ...body, createdById: user.sub }, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ASSOCIATE, Role.SENIOR_ASSOCIATE, Role.SUPERADMIN)
  @Delete(':flightInstanceId')
  removeFlightInstance(@Param('flightInstanceId') flightInstanceId: string, @CurrentUser() user: JwtPayload) {
    return this.flightsService.removeFlightInstance(flightInstanceId, user);
  }
}
