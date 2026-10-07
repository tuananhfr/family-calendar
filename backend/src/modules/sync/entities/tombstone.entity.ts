import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Last deletion of a resource, kept until the tombstone horizon so lagging clients still learn about it. */
@Entity({ name: 'tombstones' })
export class TombstoneEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'resource_type', type: 'varchar', length: 40 }) resourceType: string;
  @PrimaryColumn({ name: 'resource_id', type: 'char', length: 36 }) resourceId: string;
  @Column({ type: 'bigint', unsigned: true }) revision: string;
  @Column({ type: 'bigint', unsigned: true }) seq: string;
  @Column({ name: 'deleted_at', type: 'datetime', precision: 3 }) deletedAt: Date;
}
