import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'item_exceptions' })
export class ItemExceptionEntity extends ResourceEntity {
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @Column({ name: 'occurrence_key', type: 'varchar', length: 100 }) occurrenceKey: string;
  @Column({ type: 'enum', enum: ['CANCEL', 'OVERRIDE'] }) kind: 'CANCEL' | 'OVERRIDE';
  @Column({ name: 'override_data', type: 'json', nullable: true }) overrideData: Record<string, unknown> | null;
}
