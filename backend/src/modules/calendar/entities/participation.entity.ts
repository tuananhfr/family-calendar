import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'participations' })
export class ParticipationEntity extends ResourceEntity {
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  /** null = applies to the whole item. */
  @Column({ name: 'occurrence_key', type: 'varchar', length: 100, nullable: true }) occurrenceKey: string | null;
  @Column({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
  @Column({ type: 'enum', enum: ['YES', 'NO', 'MAYBE'] }) response: 'YES' | 'NO' | 'MAYBE';
}
