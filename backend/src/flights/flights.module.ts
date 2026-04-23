import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { FlightHorizonCron } from './flight-horizon.cron';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

@Module({
  imports: [ElasticsearchModule, ScheduleModule],
  providers: [FlightsService, FlightHorizonCron],
  controllers: [FlightsController],
  exports: [FlightsService],
})
export class FlightsModule {}
