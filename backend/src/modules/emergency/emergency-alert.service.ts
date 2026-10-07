import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { deterministicId } from '../../common/ids';
import { redact } from '../../common/log-redaction';
import type { DeliveryContext, DeliveryResult } from '../delivery/channels/delivery-channel';
import { InAppChannel } from '../delivery/channels/in-app.channel';
import { PushChannel } from '../delivery/channels/push.channel';
import { buildSosMessage } from '../delivery/safe-message';
import type { EventRow } from './emergency.service';
import { EmergencyService } from './emergency.service';

/** Thrown so the worker retries later; only targets still waiting are sent again. */
export class SosDeliveryPending extends Error {
  name = 'SosDeliveryPending';
}

const FINAL: ReadonlySet<string> = new Set(['SUBMITTED', 'UNSUPPORTED', 'GONE']);

/**
 * Runs the SOS_ALERT job: in-app notice + push to every active device of each current recipient. The lifecycle is
 * re-read before every target, so "Tôi an toàn" stops what has not gone out yet (pushes already submitted to a push
 * service cannot be recalled).
 */
@Injectable()
export class EmergencyAlertService {
  private readonly logger = new Logger(EmergencyAlertService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly emergencies: EmergencyService,
    private readonly push: PushChannel,
    private readonly inApp: InAppChannel,
  ) {}

  async run(spaceId: string, eventId: string): Promise<void> {
    const ev = await this.event(eventId);
    if (!ev || ev.space_id !== spaceId || ev.lifecycle !== 'ACTIVE') return;
    const members = await this.emergencies.currentRecipients(this.ds.manager, ev);
    if (members.length === 0) return;
    const actors: Array<{ actor_id: string }> = await this.ds.query(
      `SELECT DISTINCT mr.actor_id FROM member_representations mr
         JOIN memberships ms ON ms.space_id = mr.space_id AND ms.actor_id = mr.actor_id AND ms.status = 'ACTIVE'
        WHERE mr.space_id = ? AND mr.member_id IN (?) AND mr.relation = 'SELF' AND mr.actor_id <> ?
        ORDER BY mr.actor_id`,
      [spaceId, members, ev.created_by_actor_id],
    );
    const done = new Map<string, string>(
      (
        await this.ds.query<Array<{ target_key: string; channel: string; status: string }>>(
          'SELECT target_key, channel, status FROM emergency_deliveries WHERE event_id = ?',
          [eventId],
        )
      ).map((r) => [`${r.channel}|${r.target_key}`, r.status]),
    );

    let pending = false;
    for (const { actor_id: actorId } of actors) {
      if ((await this.event(eventId))?.lifecycle !== 'ACTIVE') return;
      const targets: Array<{ channel: 'IN_APP' | 'PUSH'; key: string; deviceId: string | null }> = [
        { channel: 'IN_APP', key: `actor:${actorId}`, deviceId: null },
        ...(
          await this.ds.query<Array<{ id: string }>>(
            "SELECT id FROM devices WHERE actor_id = ? AND status = 'ACTIVE' ORDER BY created_at, id",
            [actorId],
          )
        ).map((d) => ({ channel: 'PUSH' as const, key: `device:${d.id}`, deviceId: d.id })),
      ];
      for (const target of targets) {
        if (FINAL.has(done.get(`${target.channel}|${target.key}`) ?? '')) continue;
        const ctx: DeliveryContext = {
          compose: () =>
            buildSosMessage({
              type: 'SOS',
              spaceId,
              eventId,
              // The in-app row id: one notice per event and person, however often the job retries.
              deliveryId: target.channel === 'IN_APP' ? deterministicId('sos', eventId, actorId) : eventId,
            }),
          urgent: true,
          isPrivate: true,
        };
        const channel = target.channel === 'PUSH' ? this.push : this.inApp;
        let result: DeliveryResult;
        try {
          result = await channel.send({ spaceId, actorId, deviceId: target.deviceId, memberId: null }, ctx);
        } catch (err) {
          this.logger.warn(
            JSON.stringify(redact({ event: 'sos.delivery_failed', channel: target.channel, error: err })),
          );
          result = 'RETRY';
        }
        if (result === 'RETRY') pending = true;
        await this.ds.query(
          `INSERT INTO emergency_deliveries (event_id, target_key, channel, status, attempts, updated_at)
           VALUES (?, ?, ?, ?, 1, UTC_TIMESTAMP(3))
           ON DUPLICATE KEY UPDATE status = VALUES(status), attempts = attempts + 1, updated_at = VALUES(updated_at)`,
          [eventId, target.key, target.channel, result],
        );
      }
    }
    if (pending) throw new SosDeliveryPending();
  }

  private async event(id: string): Promise<EventRow | undefined> {
    const [row]: EventRow[] = await this.ds.query(
      `SELECT id, space_id, created_by_actor_id, lifecycle, recipient_member_ids FROM emergency_events WHERE id = ?`,
      [id],
    );
    return row;
  }
}
