import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class ScreenTime1791301400000 implements MigrationInterface {
  name = 'ScreenTime1791301400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE screen_devices (
      id ${ID} NOT NULL PRIMARY KEY, space_id ${ID} NOT NULL, member_id ${ID} NOT NULL,
      grant_actor_id ${ID} NOT NULL, grant_device_id ${ID} NOT NULL,
      label VARCHAR(100) NOT NULL, token_hash ${HASH} NULL UNIQUE,
      state ENUM('UNLINKED','PENDING_PERMISSION','ACTIVE','PERMISSION_REVOKED','DISCONNECTED') NOT NULL,
      consent_at DATETIME(3) NULL, last_seen_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_screen_device_scope (space_id, member_id, id),
      CONSTRAINT fk_screen_device_member FOREIGN KEY (space_id, member_id) REFERENCES members (space_id, id),
      CONSTRAINT fk_screen_device_grant FOREIGN KEY (grant_device_id) REFERENCES devices (id)
    ) ${TABLE_OPTIONS}`);
    await q.query(`CREATE TABLE screen_pairings (
      id ${ID} NOT NULL PRIMARY KEY, device_id ${ID} NOT NULL, code_hash ${HASH} NOT NULL UNIQUE,
      expires_at DATETIME(3) NOT NULL, consumed_at DATETIME(3) NULL,
      CONSTRAINT fk_screen_pair_device FOREIGN KEY (device_id) REFERENCES screen_devices (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
    await q.query(`CREATE TABLE screen_daily_usage (
      space_id ${ID} NOT NULL, member_id ${ID} NOT NULL, device_id ${ID} NOT NULL,
      local_date CHAR(10) CHARACTER SET ascii NOT NULL, time_zone VARCHAR(80) NOT NULL,
      captured_at DATETIME(3) NOT NULL, observed_from DATETIME(3) NOT NULL,
      total_seconds INT UNSIGNED NOT NULL, coverage ENUM('COMPLETE','PARTIAL') NOT NULL,
      apps JSON NOT NULL, algorithm_version VARCHAR(40) NOT NULL,
      PRIMARY KEY (device_id, local_date), KEY idx_screen_daily_member (space_id, member_id, local_date),
      CONSTRAINT fk_screen_daily_device FOREIGN KEY (space_id, member_id, device_id)
        REFERENCES screen_devices (space_id, member_id, id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
    await q.query(`CREATE TABLE screen_batches (
      device_id ${ID} NOT NULL, batch_id ${ID} NOT NULL, payload_hash ${HASH} NOT NULL,
      created_at DATETIME(3) NOT NULL, PRIMARY KEY (device_id, batch_id),
      CONSTRAINT fk_screen_batch_device FOREIGN KEY (device_id) REFERENCES screen_devices (id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);
    await q.query(`CREATE TABLE screen_goals (
      space_id ${ID} NOT NULL, member_id ${ID} NOT NULL, limit_minutes SMALLINT UNSIGNED NOT NULL,
      reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE, version INT UNSIGNED NOT NULL,
      updated_at DATETIME(3) NOT NULL, PRIMARY KEY (space_id, member_id),
      CONSTRAINT fk_screen_goal_member FOREIGN KEY (space_id, member_id) REFERENCES members (space_id, id)
    ) ${TABLE_OPTIONS}`);
    await q.query(`CREATE TABLE screen_alerts (
      space_id ${ID} NOT NULL, member_id ${ID} NOT NULL, local_date CHAR(10) CHARACTER SET ascii NOT NULL,
      threshold SMALLINT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, member_id, local_date, threshold),
      CONSTRAINT fk_screen_alert_member FOREIGN KEY (space_id, member_id) REFERENCES members (space_id, id)
    ) ${TABLE_OPTIONS}`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'screen_alerts',
      'screen_goals',
      'screen_batches',
      'screen_daily_usage',
      'screen_pairings',
      'screen_devices',
    ]) {
      await q.query(`DROP TABLE ${table}`);
    }
  }
}
