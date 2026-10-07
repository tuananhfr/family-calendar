import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration';
import type { DeliveryChannel, DeliveryContext, DeliveryResult, DeliveryTarget } from './delivery-channel';
import { EmailChannel } from './email.channel';

@Injectable()
export class EmailDeliveryChannel implements DeliveryChannel {
  readonly kind = 'EMAIL' as const;
  private readonly appUrl: string;

  constructor(
    private readonly ds: DataSource,
    private readonly email: EmailChannel,
    config: ConfigService<AppConfig, true>,
  ) {
    this.appUrl = `${config.get('frontendOrigin', { infer: true })}/`;
  }

  async send(target: DeliveryTarget, ctx: DeliveryContext): Promise<DeliveryResult> {
    if (!target.memberId) return 'UNSUPPORTED';
    const [member]: Array<{ email: string | null }> = await this.ds.query(
      "SELECT email FROM members WHERE space_id = ? AND id = ? AND deleted_at IS NULL AND status = 'ACTIVE'",
      [target.spaceId, target.memberId],
    );
    if (!member?.email) return 'UNSUPPORTED';
    // Mail sits in third-party mailboxes and previews, so it is always the generic text.
    const message = ctx.compose({ showDetails: false });
    await this.email.send({
      to: member.email,
      subject: message.title,
      text: [message.body, '', this.appUrl].join('\n'),
    });
    return 'SUBMITTED';
  }
}
