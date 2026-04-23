import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CheckinService } from './checkin.service';

@Controller('checkin')
@UseGuards(JwtAuthGuard)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get(':bookingId')
  status(@Param('bookingId') bookingId: string, @CurrentUser() user: { sub: string }) {
    return this.checkinService.getEligibility(bookingId, user.sub);
  }

  @Post(':bookingId')
  complete(@Param('bookingId') bookingId: string, @CurrentUser() user: { sub: string }) {
    return this.checkinService.checkIn(bookingId, user.sub);
  }
}
