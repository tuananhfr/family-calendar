import { Column, Entity, PrimaryColumn } from 'typeorm';

export type NotificationJobStatus =
  'SCHEDULED' | 'LEASED' | 'PUSH_SUBMITTED' | 'RETRY_WAIT' | 'CANCELED' | 'EXPIRED' | 'FAILED' | 'UNSUPPORTED';

/** One delivery attempt chain for one trigger of one occurrence, rule revision, target and channel (reminders.md). */
@Entity({ name: 'notification_jobs' })
export class NotificationJobEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @Column({ name: 'occurrence_key', type: 'varchar', length: 100 }) occurrenceKey: string;
  @Column({ name: 'rule_id', type: 'char', length: 36 }) ruleId: string;
  @Column({ name: 'rule_revision', type: 'bigint', unsigned: true }) ruleRevision: string;
  /** `device:<id>`, `actor:<id>` or `member:<id>`. */
  @Column({ name: 'target_key', type: 'varchar', length: 60 }) targetKey: string;
  @Column({ name: 'target_device_id', type: 'char', length: 36, nullable: true }) targetDeviceId: string | null;
  @Column({ name: 'target_actor_id', type: 'char', length: 36, nullable: true }) targetActorId: string | null;
  @Column({ name: 'target_member_id', type: 'char', length: 36, nullable: true }) targetMemberId: string | null;
  @Column({ type: 'enum', enum: ['IN_APP', 'PUSH', 'EMAIL', 'SMS'] }) channel: string;
  /** Minutes before start, `<n>M` for calendar months, or `snooze@<ISO instant>`. */
  @Column({ name: 'trigger_offset', type: 'varchar', length: 40 }) triggerOffset: string;
  @Column({ name: 'scheduled_at', type: 'datetime', precision: 3 }) scheduledAt: Date;
  @Column({ name: 'next_attempt_at', type: 'datetime', precision: 3 }) nextAttemptAt: Date;
  @Column({
    type: 'enum',
    enum: ['SCHEDULED', 'LEASED', 'PUSH_SUBMITTED', 'RETRY_WAIT', 'CANCELED', 'EXPIRED', 'FAILED', 'UNSUPPORTED'],
  })
  status: NotificationJobStatus;
  @Column({ type: 'int' }) attempts: number;
  @Column({ name: 'lease_owner', type: 'varchar', length: 64, nullable: true }) leaseOwner: string | null;
  @Column({ name: 'lease_until', type: 'datetime', precision: 3, nullable: true }) leaseUntil: Date | null;
  @Column({ name: 'last_error_code', type: 'varchar', length: 64, nullable: true }) lastErrorCode: string | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
