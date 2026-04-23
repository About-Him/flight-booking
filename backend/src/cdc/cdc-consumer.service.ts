import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CdcConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly es: ElasticsearchService,
    private readonly prisma: PrismaService,
  ) {
    const kafka = new Kafka({
      clientId: 'cdc-consumer',
      brokers: [this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
    });
    this.consumer = kafka.consumer({ groupId: 'cdc-es-sync' });
  }

  async onModuleInit() {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: 'dbserver1.public.FlightInstance',
        fromBeginning: true,
      });
    } catch {
      return;
    }

    try {
      await this.consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) {
            return;
          }

          const event = JSON.parse(message.value.toString());
          const payload = event.payload;
          if (!payload) {
            return;
          }

          if ((payload.op === 'c' || payload.op === 'u') && payload.after) {
            const after = payload.after;
            const flight = await this.prisma.flight.findUnique({
              where: { id: after.flightId ?? after.flight_id },
              include: { airline: true },
            });

            await this.es.indexFlightInstance({
              id: after.id,
              instanceId: after.instanceId ?? after.instance_id,
              flightId: after.flightId ?? after.flight_id,
              airlineId: flight?.airlineId,
              airlineName: flight?.airline?.name,
              flightNumber: flight?.flightNumber,
              origin: flight?.origin,
              destination: flight?.destination,
              departureAt: this.debeziumTsToDate(after.departureAt ?? after.departure_at),
              arrivalAt: this.debeziumTsToDate(after.arrivalAt ?? after.arrival_at),
              status: after.status,
            });
          }

          if (payload.op === 'd' && payload.before) {
            await this.es.deleteFlightInstance(payload.before.id);
          }
        },
      });
    } catch {
      return;
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private debeziumTsToDate(value: unknown): Date {
    if (typeof value === 'number') {
      return new Date(Math.floor(value / 1000));
    }

    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return new Date(Math.floor(Number(value) / 1000));
    }

    return new Date(value as string);
  }
}
