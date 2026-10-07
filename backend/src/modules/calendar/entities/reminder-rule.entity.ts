import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** Recipients live in reminder_recipients. */
@Entity({ name: 'reminder_rules' })
export class ReminderRuleEntity extends ResourceEntity {
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @Column({ name: 'offsets_minutes', type: 'json' }) offsetsMinutes: number[];
  @Column({ name: 'offset_months', type: 'json', nullable: true }) offsetMonths: number[] | null;
  @Column({ type: 'json' }) channels: string[];
  @Column({ type: 'enum', enum: ['HIGH', 'MEDIUM', 'LOW'] }) priority: 'HIGH' | 'MEDIUM' | 'LOW';
  @Column({ name: 'sound_key', type: 'varchar', length: 50, nullable: true }) soundKey: string | null;
  @Column({ name: 'audio_asset_id', type: 'char', length: 36, nullable: true }) audioAssetId: string | null;
  @Column({ type: 'boolean' }) enabled: boolean;
}
