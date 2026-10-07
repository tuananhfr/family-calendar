import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type JobStatus = 'SCHEDULED' | 'LEASED' | 'DONE' | 'RETRY_WAIT' | 'CANCELED' | 'FAILED';

@Entity({ name: 'jobs' })
export class JobEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'varchar', length: 64 }) type: string;
  @Column({ name: 'dedupe_key', type: 'varchar', length: 191, nullable: true }) dedupeKey: string | null;
  @Column({ type: 'json' }) payload: Record<string, unknown>;
  @Column({ name: 'run_at', type: 'datetime', precision: 3 }) runAt: Date;
  /** Lower leases first (JOB_PRIORITY). */
  @Column({ type: 'tinyint', unsigned: true }) priority: number;
  @Column({ type: 'enum', enum: ['SCHEDULED', 'LEASED', 'DONE', 'RETRY_WAIT', 'CANCELED', 'FAILED'] })
  status: JobStatus;
  @Column({ type: 'int' }) attempts: number;
  @Column({ name: 'lease_owner', type: 'varchar', length: 64, nullable: true }) leaseOwner: string | null;
  @Column({ name: 'lease_until', type: 'datetime', precision: 3, nullable: true }) leaseUntil: Date | null;
  @Column({ name: 'last_error_code', type: 'varchar', length: 64, nullable: true }) lastErrorCode: string | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
