import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** Lịch / Nhắc / Việc (modules.md §4); members assigned via item_members. */
@Entity({ name: 'items' })
export class ItemEntity extends ResourceEntity {
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
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ name: 'all_day', type: 'boolean' }) allDay: boolean;
  /** Wall-clock 'YYYY-MM-DD' (all-day) or 'YYYY-MM-DDTHH:mm', read with `timeZone`. */
  @Column({ name: 'start_local', type: 'char', length: 16 }) startLocal: string;
  @Column({ name: 'end_local', type: 'char', length: 16, nullable: true }) endLocal: string | null;
  @Column({ name: 'time_zone', type: 'varchar', length: 64 }) timeZone: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) rrule: string | null;
  @Column({ name: 'lunar_rule', type: 'json', nullable: true }) lunarRule: Record<string, unknown> | null;
  @Column({ name: 'responsible_member_id', type: 'char', length: 36, nullable: true }) responsibleMemberId:
    string | null;
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
  @Column({ type: 'enum', enum: ['HIGH', 'MEDIUM', 'LOW'] }) priority: 'HIGH' | 'MEDIUM' | 'LOW';
  @Column({ type: 'varchar', length: 2000, nullable: true }) note: string | null;
  @Column({ name: 'location_text', type: 'varchar', length: 200, nullable: true }) locationText: string | null;
  /** File ids in Kho lưu trữ; same-Space membership is checked by the validator. */
  @Column({ type: 'json' }) attachments: string[];
  @Column({ name: 'show_on_calendar', type: 'boolean' }) showOnCalendar: boolean;
  @Column({ name: 'calendar_system', type: 'enum', enum: ['SOLAR', 'LUNAR'] }) calendarSystem: 'SOLAR' | 'LUNAR';
  @Column({ name: 'template_key', type: 'varchar', length: 100, nullable: true }) templateKey: string | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt: Date | null;
  @Column({ type: 'decimal', precision: 15, scale: 0, nullable: true }) amount: string | null;
  @Column({ type: 'char', length: 3, nullable: true }) currency: string | null;
  @Column({ name: 'document_type', type: 'varchar', length: 100, nullable: true }) documentType: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) subject: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) teacher: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) room: string | null;
  @Column({ name: 'audio_asset_id', type: 'char', length: 36, nullable: true }) audioAssetId: string | null;
  @Column({ name: 'sound_key', type: 'varchar', length: 50, nullable: true }) soundKey: string | null;
  @Column({ name: 'source_reference', type: 'varchar', length: 200, nullable: true }) sourceReference: string | null;
}
