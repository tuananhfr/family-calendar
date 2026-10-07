import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Per-Space change feed; seq is allocated from spaces.change_seq under the Space row lock. */
@Entity({ name: 'sync_changes' })
export class SyncChangeEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ type: 'bigint', unsigned: true }) seq: string;
  @Column({ name: 'resource_type', type: 'varchar', length: 40 }) resourceType: string;
  @Column({ name: 'resource_id', type: 'char', length: 36 }) resourceId: string;
  @Column({ type: 'bigint', unsigned: true }) revision: string;
  @Column({ type: 'enum', enum: ['UPSERT', 'DELETE'] }) op: 'UPSERT' | 'DELETE';
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
