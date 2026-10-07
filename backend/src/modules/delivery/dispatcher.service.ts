import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { redact } from '../../common/log-redaction';
import type { DispatchJob, DispatchResult, NotificationDispatcher } from '../reminders/dispatch';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import type { DeliveryChannel, DeliveryKind } from './channels/delivery-channel';
import { EmailDeliveryChannel } from './channels/email-delivery.channel';
import { InAppChannel } from './channels/in-app.channel';
import { PushChannel } from './channels/push.channel';
import { SmsChannel } from './channels/sms.channel';
import { buildSafeMessage, type SafeItem } from './safe-message';

@Injectable()
export class DeliveryDispatcher implements NotificationDispatcher {
  private readonly logger = new Logger(DeliveryDispatcher.name);
  private readonly channels: Record<DeliveryKind, DeliveryChannel>;

  constructor(
    private readonly ds: DataSource,
    push: PushChannel,
    inApp: InAppChannel,
    email: EmailDeliveryChannel,
    sms: SmsChannel,
  ) {
    this.channels = { PUSH: push, IN_APP: inApp, EMAIL: email, SMS: sms };
  }

  async dispatch(job: DispatchJob): Promise<DispatchResult> {
    const [row] = await RESOURCE_REGISTRY.item.find(this.ds.manager, job.spaceId, [job.itemId]);
    if (!row || row.deleted_at) return 'GONE';
    const item: SafeItem = {
      title: String(row.title),
      dataClass: String(row.data_class),
      sharingScope: String(row.sharing_scope),
      category: row.category ? String(row.category) : undefined,
      preset: row.preset ? String(row.preset) : undefined,
    };
    const ref = {
      type: 'REMINDER_DUE',
      spaceId: job.spaceId,
      itemId: job.itemId,
      occurrenceKey: job.occurrenceKey,
      deliveryId: job.id,
    };
    try {
      return await this.channels[job.channel].send(
        {
          spaceId: job.spaceId,
          deviceId: job.targetDeviceId,
          actorId: job.targetActorId,
          memberId: job.targetMemberId,
        },
        {
          compose: (pref) => buildSafeMessage(item, pref, ref),
          urgent: item.preset === 'MEDICATION',
          isPrivate: item.dataClass === 'PRIVATE' || item.sharingScope === 'PRIVATE',
        },
      );
    } catch (err) {
      this.logger.warn(
        JSON.stringify(redact({ event: 'delivery.failed', channel: job.channel, job: job.id, error: err })),
      );
      return 'RETRY';
    }
  }
}
