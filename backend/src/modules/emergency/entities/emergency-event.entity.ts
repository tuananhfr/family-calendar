import { Column, Entity, PrimaryColumn } from 'typeorm';

export const EMERGENCY_LIFECYCLES = ['ACTIVE', 'CLOSED_SAFE', 'CLOSED_ENDED'] as const;
export type EmergencyLifecycle = (typeof EMERGENCY_LIFECYCLES)[number];

@Entity({ name: 'emergency_events' })
export class EmergencyEventEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'created_by_actor_id', type: 'char', length: 36 }) createdByActorId: string;
  @Column({ name: 'created_by_device_id', type: 'char', length: 36 }) createdByDeviceId: string;
  @Column({ name: 'operation_id', type: 'char', length: 36 }) operationId: string;
  @Column({ name: 'client_triggered_at', type: 'datetime', precision: 3 }) clientTriggeredAt: Date;
  @Column({ name: 'server_received_at', type: 'datetime', precision: 3 }) serverReceivedAt: Date;
  @Column({ type: 'enum', enum: EMERGENCY_LIFECYCLES }) lifecycle: EmergencyLifecycle;
  @Column({ type: 'bigint', unsigned: true }) revision: string;
  @Column({ name: 'closed_at', type: 'datetime', precision: 3, nullable: true }) closedAt: Date | null;
  @Column({ name: 'closed_by_actor_id', type: 'char', length: 36, nullable: true }) closedByActorId: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) reason: string | null;
  @Column({ name: 'recipient_member_ids', type: 'json' }) recipientMemberIds: string[];
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
