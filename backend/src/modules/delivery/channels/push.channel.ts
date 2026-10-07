import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { redact } from '../../../common/log-redaction';
import type { AppConfig } from '../../../config/configuration';
import type { DeliveryChannel, DeliveryContext, DeliveryResult, DeliveryTarget } from './delivery-channel';
import { WEB_PUSH_TRANSPORT, type WebPushOptions, type WebPushTransport } from './web-push.transport';

const TTL_URGENT_S = 3600;
const TTL_DEFAULT_S = 86_400;

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  show_details: number;
}

@Injectable()
export class PushChannel implements DeliveryChannel {
  readonly kind = 'PUSH' as const;
  private readonly logger = new Logger(PushChannel.name);
  private readonly vapid: WebPushOptions['vapidDetails'] | null;

  constructor(
    private readonly ds: DataSource,
    config: ConfigService<AppConfig, true>,
    @Inject(WEB_PUSH_TRANSPORT) private readonly transport: WebPushTransport,
  ) {
    const v = config.get('vapid', { infer: true });
    this.vapid = v.publicKey && v.privateKey ? { ...v } : null;
  }

  get configured(): boolean {
    return this.vapid !== null;
  }

  /** SUBMITTED means a push service accepted it, not that anyone saw it (reminders.md "State và giao nhận"). */
  async send(target: DeliveryTarget, ctx: DeliveryContext): Promise<DeliveryResult> {
    if (!this.vapid || !target.deviceId) return 'UNSUPPORTED';
    const subs: SubscriptionRow[] = await this.ds.query(
      'SELECT id, endpoint, p256dh, auth, show_details FROM push_subscriptions WHERE device_id = ? AND actor_id = ?',
      [target.deviceId, target.actorId],
    );
    if (subs.length === 0) return 'UNSUPPORTED';

    let submitted = false;
    let retry = false;
    for (const sub of subs) {
      const message = ctx.compose({ showDetails: Number(sub.show_details) === 1 });
      let statusCode: number;
      try {
        ({ statusCode } = await this.transport.send(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
          {
            TTL: ctx.urgent ? TTL_URGENT_S : TTL_DEFAULT_S,
            urgency: ctx.urgent ? 'high' : 'normal',
            topic: message.tag,
            vapidDetails: this.vapid,
          },
        ));
      } catch (err) {
        this.logger.warn(JSON.stringify(redact({ event: 'push.unreachable', subscription_id: sub.id, error: err })));
        retry = true;
        continue;
      }
      if (statusCode >= 200 && statusCode < 300) {
        submitted = true;
      } else if (statusCode === 404 || statusCode === 410) {
        // The browser dropped this subscription; keeping it would only retry into a void.
        await this.ds.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      } else {
        this.logger.warn(
          JSON.stringify(
            redact({ event: 'push.rejected', subscription_id: sub.id, status: statusCode, payload: message }),
          ),
        );
        retry = true;
      }
    }
    if (submitted) return 'SUBMITTED';
    return retry ? 'RETRY' : 'GONE';
  }
}
