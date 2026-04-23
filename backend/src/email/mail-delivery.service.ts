import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey && apiKey.startsWith('SG.') && apiKey.length > 10) {
      sgMail.setApiKey(apiKey);
    }
  }

  async deliver(toEmail: string, subject: string, html: string, bookingId?: string) {
    const from = this.configService.get<string>('SENDGRID_FROM_EMAIL') || 'noreply@example.com';
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY') || '';
    const canSend = apiKey.startsWith('SG.') && apiKey.length > 10;

    if (!canSend) {
      this.logger.warn(
        'SENDGRID_API_KEY missing or not a valid SG.* key — email not sent. Check SendGrid dashboard API keys.',
      );
      await this.prisma.emailLog.create({
        data: {
          toEmail,
          subject,
          status: 'skipped_no_sendgrid',
          bookingId,
        },
      });
      return;
    }

    try {
      await sgMail.send({ to: toEmail, from, subject, html });

      await this.prisma.emailLog.create({
        data: {
          toEmail,
          subject,
          status: 'sent',
          bookingId,
        },
      });
    } catch (error) {
      this.logger.error('Email send failed', error as Error);
      await this.prisma.emailLog.create({
        data: {
          toEmail,
          subject,
          status: 'failed',
          bookingId,
        },
      });
    }
  }
}
