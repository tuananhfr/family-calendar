import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'push_subscriptions' })
export class PushSubscriptionEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'device_id', type: 'char', length: 36 }) deviceId: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ type: 'varchar', length: 1000 }) endpoint: string;
  @Column({ name: 'endpoint_hash', type: 'char', length: 64 }) endpointHash: string;
  @Column({ type: 'varchar', length: 200 }) p256dh: string;
  @Column({ type: 'varchar', length: 100 }) auth: string;
  /** Per device: a lock screen belongs to one device, so the choice to show titles is made there. */
  @Column({ name: 'show_details', type: 'tinyint' }) showDetails: number;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
