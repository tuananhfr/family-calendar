import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Metadata only: never titles, notes or amounts (modules.md §2.4). */
@Entity({ name: 'audit_events' })
export class AuditEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36, nullable: true }) spaceId: string | null;
  @Column({ name: 'actor_id', type: 'char', length: 36, nullable: true }) actorId: string | null;
  @Column({ name: 'device_id', type: 'char', length: 36, nullable: true }) deviceId: string | null;
  @Column({ type: 'varchar', length: 64 }) action: string;
  @Column({ name: 'resource_type', type: 'varchar', length: 40, nullable: true }) resourceType: string | null;
  @Column({ name: 'resource_id', type: 'char', length: 36, nullable: true }) resourceId: string | null;
  @Column({ type: 'bigint', nullable: true }) revision: string | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
