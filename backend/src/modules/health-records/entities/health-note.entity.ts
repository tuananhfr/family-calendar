import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'health_notes' })
export class HealthNoteEntity extends ResourceEntity {
  @Column({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'text' }) body: string;
}
