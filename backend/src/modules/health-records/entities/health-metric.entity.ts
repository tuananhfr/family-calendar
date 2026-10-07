import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'health_metrics' })
export class HealthMetricEntity extends ResourceEntity {
  @Column({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
  @Column({
    type: 'enum',
    enum: ['WEIGHT', 'HEIGHT', 'BLOOD_PRESSURE', 'HEART_RATE', 'SLEEP', 'BLOOD_GLUCOSE', 'TEMPERATURE', 'CUSTOM'],
  })
  type: string;
  /** Systolic for BLOOD_PRESSURE. */
  @Column({ type: 'decimal', precision: 12, scale: 3 }) value: string;
  /** Diastolic for BLOOD_PRESSURE. */
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true }) value2: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) unit: string | null;
  @Column({ name: 'custom_name', type: 'varchar', length: 50, nullable: true }) customName: string | null;
  @Column({ name: 'measured_at', type: 'char', length: 16 }) measuredAt: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
}
