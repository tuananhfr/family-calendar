import { Column, Entity, PrimaryColumn } from 'typeorm';

export type DeviceStatus = 'ACTIVE' | 'REVOKED';

@Entity({ name: 'devices' })
export class DeviceEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) label: string | null;
  @Column({ name: 'user_agent_hash', type: 'char', length: 64, nullable: true }) userAgentHash: string | null;
  @Column({ type: 'enum', enum: ['ACTIVE', 'REVOKED'] }) status: DeviceStatus;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt: Date | null;
}
