import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CLOCK, type Clock } from '../../jobs/clock';
import type { DeliveryChannel, DeliveryContext, DeliveryResult, DeliveryTarget } from './delivery-channel';

@Injectable()
export class InAppChannel implements DeliveryChannel {
  readonly kind = 'IN_APP' as const;

  constructor(
    private readonly ds: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async send(target: DeliveryTarget, ctx: DeliveryContext): Promise<DeliveryResult> {
    if (!target.actorId) return 'UNSUPPORTED';
    // The bell list is inside the signed-in app, but it can still be seen over a shoulder: PRIVATE stays generic.
    const message = ctx.compose({ showDetails: !ctx.isPrivate });
    const ref = message.data;
    // The delivery id is the row id, so a retried job never creates a second notification.
    await this.ds.query(
      `INSERT IGNORE INTO notifications (id, actor_id, space_id, type, resource_ref, title_safe, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ref.deliveryId,
        target.actorId,
        target.spaceId,
        ref.type,
        JSON.stringify(
          ref.eventId
            ? { event_id: ref.eventId }
            : { item_id: ref.itemId ?? null, occurrence_key: ref.occurrenceKey ?? null },
        ),
        message.body.slice(0, 200),
        this.clock.now(),
      ],
    );
    return 'SUBMITTED';
  }
}
