import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FlightsModule } from './flights/flights.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { EmailModule } from './email/email.module';
import { AdminModule } from './admin/admin.module';
import { SuperadminModule } from './superadmin/superadmin.module';
import { AirportsModule } from './airports/airports.module';
import { CheckinModule } from './checkin/checkin.module';
import { HealthModule } from './health/health.module';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module';
import { CdcModule } from './cdc/cdc.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ElasticsearchModule,
    CdcModule,
    FlightsModule,
    BookingsModule,
    PaymentsModule,
    EmailModule,
    AdminModule,
    SuperadminModule,
    AirportsModule,
    CheckinModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
