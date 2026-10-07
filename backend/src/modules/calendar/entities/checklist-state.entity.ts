import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'checklist_states' })
export class ChecklistStateEntity extends ResourceEntity {
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @Column({ name: 'checklist_item_id', type: 'char', length: 36 }) checklistItemId: string;
  @Column({ name: 'occurrence_key', type: 'varchar', length: 100 }) occurrenceKey: string;
  @Column({ type: 'boolean' }) checked: boolean;
}
