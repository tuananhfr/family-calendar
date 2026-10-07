import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ID, TABLE_OPTIONS } from './ddl';

const ASCII = 'CHARACTER SET ascii COLLATE ascii_bin';

export class NotificationJobs1791300800000 implements MigrationInterface {
  name = 'NotificationJobs1791300800000';

  /**
   * One row per (occurrence, rule revision, target, channel, trigger). target_key folds the three target kinds into
   * one NOT NULL column because a UNIQUE key over nullable columns does not stop duplicates in MariaDB.
   */
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE notification_jobs (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      item_id ${ID} NOT NULL,
      occurrence_key VARCHAR(100) ${ASCII} NOT NULL,
      rule_id ${ID} NOT NULL,
      rule_revision BIGINT UNSIGNED NOT NULL,
      target_key VARCHAR(60) ${ASCII} NOT NULL,
      target_device_id ${ID} NULL,
      target_actor_id ${ID} NULL,
      target_member_id ${ID} NULL,
      channel ENUM('IN_APP','PUSH','EMAIL','SMS') NOT NULL,
      trigger_offset VARCHAR(40) ${ASCII} NOT NULL,
      scheduled_at DATETIME(3) NOT NULL,
      next_attempt_at DATETIME(3) NOT NULL,
      status ENUM('SCHEDULED','LEASED','PUSH_SUBMITTED','RETRY_WAIT','CANCELED','EXPIRED','FAILED','UNSUPPORTED')
        NOT NULL DEFAULT 'SCHEDULED',
      attempts INT NOT NULL DEFAULT 0,
      lease_owner VARCHAR(64) NULL,
      lease_until DATETIME(3) NULL,
      last_error_code VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_notification_jobs_trigger (rule_id, rule_revision, occurrence_key, target_key, channel, trigger_offset),
      KEY idx_notification_jobs_due (status, next_attempt_at),
      KEY idx_notification_jobs_item (space_id, item_id, status),
      CONSTRAINT fk_notification_jobs_item FOREIGN KEY (space_id, item_id) REFERENCES items (space_id, id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE notification_jobs');
  }
}
