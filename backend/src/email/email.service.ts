import { Injectable, Logger } from '@nestjs/common';
import { KafkaMailConsumerService } from './kafka-mail-consumer.service';
import { KafkaMailProducerService } from './kafka-mail-producer.service';
import { MailDeliveryService } from './mail-delivery.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly kafkaMail: KafkaMailProducerService,
    private readonly kafkaConsumer: KafkaMailConsumerService,
    private readonly mailDelivery: MailDeliveryService,
  ) {}

  async sendBookingStatusEmail(toEmail: string, subject: string, html: string, bookingId?: string) {
    const useQueue = this.kafkaMail.isReady() && this.kafkaConsumer.isReady();
    if (!useQueue && this.kafkaMail.isReady() && !this.kafkaConsumer.isReady()) {
      this.logger.warn(
        'Kafka producer is up but mail consumer is not — sending email directly (otherwise messages would never be delivered).',
      );
    }

    try {
      if (useQueue) {
        await this.kafkaMail.enqueue({ toEmail, subject, html, bookingId });
        this.logger.log(`Booking mail queued (Kafka) bookingId=${bookingId ?? 'n/a'}`);
        return;
      }
    } catch (error) {
      this.logger.warn(`Kafka enqueue failed, sending direct: ${(error as Error).message}`);
    }

    await this.mailDelivery.deliver(toEmail, subject, html, bookingId);
  }
}
