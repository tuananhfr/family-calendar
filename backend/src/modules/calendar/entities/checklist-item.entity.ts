import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'checklist_items' })
export class ChecklistItemEntity extends ResourceEntity {
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @Column({ type: 'varchar', length: 200 }) text: string;
  @Column({ type: 'int', unsigned: true }) position: number;
}
