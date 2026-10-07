import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'emergency_deliveries' })
export class EmergencyDeliveryEntity {
  @PrimaryColumn({ name: 'event_id', type: 'char', length: 36 }) eventId: string;
  @PrimaryColumn({ name: 'target_key', type: 'varchar', length: 80 }) targetKey: string;
  @PrimaryColumn({ type: 'enum', enum: ['PUSH', 'IN_APP'] }) channel: 'PUSH' | 'IN_APP';
  @Column({ type: 'enum', enum: ['SUBMITTED', 'UNSUPPORTED', 'GONE', 'RETRY'] }) status: string;
  @Column({ type: 'int' }) attempts: number;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
