import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({
  imports: [EmailModule],
  providers: [CheckinService],
  controllers: [CheckinController],
})
export class CheckinModule {}
