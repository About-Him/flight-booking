import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

export interface BookingMailPayload {
  toEmail: string;
  subject: string;
  html: string;
  bookingId?: string;
}

@Injectable()
export class KafkaMailProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaMailProducerService.name);
  private producer?: Producer;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      const kafka = new Kafka({
        clientId: 'flight-booking-mail',
        brokers: [this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
      });
      this.producer = kafka.producer();
      await this.producer.connect();
    } catch (error) {
      this.logger.warn(`Kafka mail producer disabled: ${(error as Error).message}`);
      this.producer = undefined;
    }
  }

  async onModuleDestroy() {
    await this.producer?.disconnect().catch(() => null);
  }

  isReady() {
    return !!this.producer;
  }

  async enqueue(payload: BookingMailPayload) {
    if (!this.producer) {
      throw new Error('Kafka mail producer not connected');
    }
    await this.producer.send({
      topic: 'booking.notifications',
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}
