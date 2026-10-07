import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class NotificationsPush1791300900000 implements MigrationInterface {
  name = 'NotificationsPush1791300900000';

  public async up(q: QueryRunner): Promise<void> {
    // modules.md §13. title_safe is already privacy-filtered; nothing else about the record is stored here.
    await q.query(`CREATE TABLE notifications (
      id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      type ENUM('REMINDER_DUE','INVITE','JOIN_REQUEST','SOS','SYNC_CONFLICT','BUDGET_ALERT','AUTOMATION','SYSTEM') NOT NULL,
      resource_ref JSON NULL,
      title_safe VARCHAR(200) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      read_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY idx_notifications_actor (actor_id, created_at, id),
      KEY idx_notifications_unread (actor_id, read_at),
      CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT fk_notifications_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT chk_notifications_ref CHECK (resource_ref IS NULL OR JSON_VALID(resource_ref))
    ) ${TABLE_OPTIONS}`);

    // Endpoint and keys are access credentials (reminders.md): stored for sending only, never returned.
    await q.query(`CREATE TABLE push_subscriptions (
      id ${ID} NOT NULL,
      device_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      endpoint VARCHAR(1000) CHARACTER SET ascii NOT NULL,
      endpoint_hash ${HASH} NOT NULL,
      p256dh VARCHAR(200) CHARACTER SET ascii NOT NULL,
      auth VARCHAR(100) CHARACTER SET ascii NOT NULL,
      show_details TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_push_subscriptions_endpoint (endpoint_hash),
      KEY idx_push_subscriptions_device (device_id),
      CONSTRAINT fk_push_subscriptions_device FOREIGN KEY (device_id) REFERENCES devices (id),
      CONSTRAINT fk_push_subscriptions_actor FOREIGN KEY (actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE push_subscriptions');
    await q.query('DROP TABLE notifications');
  }
}
