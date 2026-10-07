import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { AppConfig } from '../../../config/configuration';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  /** Path of the .eml file in `file` mode; undefined when sent over SMTP. */
  file?: string;
}

const FROM = 'Lịch Gia Đình <no-reply@lich-gia-dinh.local>';

/**
 * TEC-14: `file` transport (default, dev/test) renders the message and writes it under MAIL_DIR instead of sending;
 * SMTP is used only when MAIL_TRANSPORT=smtp is configured explicitly.
 */
@Injectable()
export class EmailChannel {
  private readonly mode: 'file' | 'smtp';
  private readonly dir: string;
  private readonly transport: Transporter;

  constructor(config: ConfigService<AppConfig, true>) {
    const mail = config.get('mail', { infer: true });
    this.mode = mail.transport === 'smtp' && mail.smtpUrl ? 'smtp' : 'file';
    this.dir = resolve(mail.dir);
    this.transport =
      this.mode === 'smtp'
        ? createTransport(mail.smtpUrl)
        : createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  }

  get writesFiles(): boolean {
    return this.mode === 'file';
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const info = (await this.transport.sendMail({ from: FROM, ...message })) as { message?: Buffer };
    if (this.mode === 'smtp') return {};
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `${Date.now()}-${randomBytes(4).toString('hex')}.eml`);
    await writeFile(file, info.message ?? Buffer.alloc(0));
    return { file };
  }
}
