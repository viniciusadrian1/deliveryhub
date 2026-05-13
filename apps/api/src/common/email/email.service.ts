import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { loadEnv } from '../../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('ConsoleEmail');

  async send(message: EmailMessage): Promise<void> {
    // Em dev sem RESEND_API_KEY, mostra o e-mail no log em vez de enviar.
    this.logger.warn(
      {
        to: message.to,
        subject: message.subject,
        preview: (message.text ?? message.html).slice(0, 280),
      },
      'EMAIL_DEV_MODE (Resend not configured)',
    );
  }
}

class ResendEmailSender implements EmailSender {
  private readonly logger = new Logger('ResendEmail');
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      this.logger.error({ err: error, to: message.to }, 'resend_send_failed');
      throw new Error(`resend_send_failed: ${error.message}`);
    }
  }
}

@Injectable()
export class EmailService {
  private readonly sender: EmailSender;

  constructor() {
    const env = loadEnv();
    this.sender = env.RESEND_API_KEY
      ? new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new ConsoleEmailSender();
  }

  send(message: EmailMessage): Promise<void> {
    return this.sender.send(message);
  }
}
