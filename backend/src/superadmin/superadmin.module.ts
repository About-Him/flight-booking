import { Module } from '@nestjs/common';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';

@Module({
  providers: [SuperadminService],
  controllers: [SuperadminController],
})
export class SuperadminModule {}
