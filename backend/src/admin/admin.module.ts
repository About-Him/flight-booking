import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BookingsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
