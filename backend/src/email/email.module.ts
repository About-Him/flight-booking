import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { KafkaMailConsumerService } from './kafka-mail-consumer.service';
import { KafkaMailProducerService } from './kafka-mail-producer.service';
import { MailDeliveryService } from './mail-delivery.service';

@Module({
  providers: [MailDeliveryService, KafkaMailProducerService, KafkaMailConsumerService, EmailService],
  exports: [EmailService, MailDeliveryService],
})
export class EmailModule {}
