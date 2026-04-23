import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InitiateBookingDto } from './dto/initiate-booking.dto';
import { BookingsService } from './bookings.service';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('initiate')
  initiate(@CurrentUser() user: JwtPayload, @Body() dto: InitiateBookingDto) {
    return this.bookingsService.initiate(user.sub, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.bookingsService.myBookings(user.sub);
  }
}
