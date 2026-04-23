import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka } from 'kafkajs';
import { MailDeliveryService } from './mail-delivery.service';
import type { BookingMailPayload } from './kafka-mail-producer.service';

@Injectable()
export class KafkaMailConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaMailConsumerService.name);
  private consumer?: Consumer;
  /** True only after subscribe + run started; used so we never enqueue without a live consumer. */
  private deliveryReady = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailDelivery: MailDeliveryService,
  ) {}

  /** Whether this process is actually consuming `booking.notifications` (SendGrid runs here). */
  isReady(): boolean {
    return this.deliveryReady;
  }

  async onModuleInit() {
    try {
      const kafka = new Kafka({
        clientId: 'flight-booking-mail-consumer',
        brokers: [this.configService.get<string>('KAFKA_BROKER') || 'localhost:9092'],
      });
      this.consumer = kafka.consumer({ groupId: 'mail-sendgrid-delivery' });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'booking.notifications', fromBeginning: false });
      await this.consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) {
            return;
          }
          try {
            const payload = JSON.parse(message.value.toString()) as BookingMailPayload;
            this.logger.log(`Delivering queued mail bookingId=${payload.bookingId ?? 'n/a'}`);
            await this.mailDelivery.deliver(payload.toEmail, payload.subject, payload.html, payload.bookingId);
          } catch (error) {
            this.logger.error('Mail consumer message failed', error as Error);
          }
        },
      });
      this.deliveryReady = true;
      this.logger.log('Kafka mail consumer subscribed to booking.notifications');
    } catch (error) {
      this.logger.warn(`Kafka mail consumer disabled: ${(error as Error).message}`);
      this.consumer = undefined;
      this.deliveryReady = false;
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect().catch(() => null);
  }
}
