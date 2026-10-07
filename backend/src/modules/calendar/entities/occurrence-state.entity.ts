import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'occurrence_states' })
export class OccurrenceStateEntity extends ResourceEntity {
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @Column({ name: 'occurrence_key', type: 'varchar', length: 100 }) occurrenceKey: string;
  @Column({ type: 'enum', enum: ['DONE', 'SNOOZED', 'SKIPPED'] }) status: 'DONE' | 'SNOOZED' | 'SKIPPED';
  @Column({ name: 'acted_at', type: 'datetime', precision: 3 }) actedAt: Date;
  @Column({ name: 'acted_by_actor_id', type: 'char', length: 36 }) actedByActorId: string;
  @Column({ name: 'snooze_until', type: 'datetime', precision: 3, nullable: true }) snoozeUntil: Date | null;
}
