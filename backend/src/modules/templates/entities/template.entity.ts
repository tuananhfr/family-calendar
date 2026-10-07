import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** User-saved plan template; system templates are static JSON in the frontend (modules.md §15). */
@Entity({ name: 'templates' })
export class TemplateEntity extends ResourceEntity {
  @Column({ type: 'enum', enum: ['EVENT', 'REMINDER', 'TASK'] }) kind: 'EVENT' | 'REMINDER' | 'TASK';
  @Column({
    type: 'enum',
    enum: [
      'TIMETABLE',
      'APPOINTMENT',
      'EVENT',
      'SPECIAL_DAY',
      'BIRTHDAY',
      'ANNIVERSARY',
      'DEATH_ANNIVERSARY',
      'HOLIDAY',
      'OTHER',
      'MEDICATION',
      'DOCUMENT',
      'PAYMENT',
      'REMEMBER',
      'PERSONAL',
      'HOUSEWORK',
      'GROUP',
      'SHOPPING',
    ],
  })
  preset: string;
  @Column({
    type: 'enum',
    enum: [
      'STUDY',
      'HOUSEWORK',
      'FAMILY',
      'HEALTH',
      'FINANCE',
      'SHOPPING',
      'DOCUMENT',
      'ACTIVITY',
      'SPORT',
      'SPECIAL',
      'OTHER',
    ],
  })
  category: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ name: 'duration_minutes', type: 'int', unsigned: true, nullable: true }) durationMinutes: number | null;
  @Column({ type: 'json' }) checklist: string[];
  @Column({ name: 'reminder_offsets_minutes', type: 'json' }) reminderOffsetsMinutes: number[];
  @Column({ type: 'varchar', length: 2000, nullable: true }) note: string | null;
}
