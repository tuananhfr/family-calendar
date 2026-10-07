import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** One per Member; family-entered notes only, never a diagnosis (modules.md §8). */
@Entity({ name: 'health_profiles' })
export class HealthProfileEntity extends ResourceEntity {
  @Column({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
  @Column({ type: 'enum', enum: ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] }) sex:
    'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
  @Column({
    name: 'blood_type',
    type: 'enum',
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    nullable: true,
  })
  bloodType: string | null;
  @Column({ name: 'height_cm', type: 'decimal', precision: 4, scale: 1, nullable: true }) heightCm: string | null;
  @Column({ type: 'json' }) allergies: string[];
  @Column({ type: 'json' }) conditions: string[];
  @Column({ name: 'insurance_number', type: 'varchar', length: 30, nullable: true }) insuranceNumber: string | null;
  @Column({ name: 'emergency_note', type: 'varchar', length: 500, nullable: true }) emergencyNote: string | null;
}
