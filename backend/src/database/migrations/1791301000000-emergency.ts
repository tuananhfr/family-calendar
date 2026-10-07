import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ID, TABLE_OPTIONS } from './ddl';

export class Emergency1791301000000 implements MigrationInterface {
  name = 'Emergency1791301000000';

  public async up(q: QueryRunner): Promise<void> {
    // Lower runs first; SOS alerts use 0 so they never wait behind reminder or AI work (sos.md "Outbox SOS có ưu tiên").
    await q.query('ALTER TABLE jobs ADD COLUMN priority TINYINT UNSIGNED NOT NULL DEFAULT 100 AFTER status');
    await q.query(
      'ALTER TABLE jobs DROP INDEX idx_jobs_status_run_at, ADD KEY idx_jobs_due (status, priority, run_at)',
    );

    // The Family's configured list; empty means the default (other OWNER/ADULT members).
    await q.query(`CREATE TABLE emergency_recipients (
      space_id ${ID} NOT NULL,
      member_id ${ID} NOT NULL,
      created_by_actor_id ${ID} NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, member_id),
      CONSTRAINT fk_emergency_recipients_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_emergency_recipients_member FOREIGN KEY (space_id, member_id) REFERENCES members (space_id, id)
        ON DELETE CASCADE
    ) ${TABLE_OPTIONS}`);

    // recipient_member_ids is the snapshot at trigger time; reads still require the current list too.
    await q.query(`CREATE TABLE emergency_events (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      created_by_actor_id ${ID} NOT NULL,
      created_by_device_id ${ID} NOT NULL,
      operation_id ${ID} NOT NULL,
      client_triggered_at DATETIME(3) NOT NULL,
      server_received_at DATETIME(3) NOT NULL,
      lifecycle ENUM('ACTIVE','CLOSED_SAFE','CLOSED_ENDED') NOT NULL,
      revision BIGINT UNSIGNED NOT NULL,
      closed_at DATETIME(3) NULL,
      closed_by_actor_id ${ID} NULL,
      reason VARCHAR(200) NULL,
      recipient_member_ids JSON NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_emergency_events_space (space_id, server_received_at, id),
      CONSTRAINT fk_emergency_events_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_emergency_events_actor FOREIGN KEY (created_by_actor_id) REFERENCES actors (id),
      CONSTRAINT fk_emergency_events_device FOREIGN KEY (created_by_device_id) REFERENCES devices (id),
      CONSTRAINT chk_emergency_events_recipients CHECK (JSON_VALID(recipient_member_ids))
    ) ${TABLE_OPTIONS}`);

    // One current response per responder; operation_id makes a replayed request a no-op.
    await q.query(`CREATE TABLE emergency_responses (
      event_id ${ID} NOT NULL,
      responder_actor_id ${ID} NOT NULL,
      responder_member_id ${ID} NULL,
      kind ENUM('ACKNOWLEDGED','RESPONDING') NOT NULL,
      operation_id ${ID} NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (event_id, responder_actor_id),
      CONSTRAINT fk_emergency_responses_event FOREIGN KEY (event_id) REFERENCES emergency_events (id),
      CONSTRAINT fk_emergency_responses_actor FOREIGN KEY (responder_actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    // SENSITIVE; kept apart from event status so status reads never touch coordinates.
    await q.query(`CREATE TABLE emergency_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      device_id ${ID} NOT NULL,
      latitude DECIMAL(9,6) NOT NULL,
      longitude DECIMAL(9,6) NOT NULL,
      accuracy_m DECIMAL(9,1) NOT NULL,
      captured_at DATETIME(3) NOT NULL,
      received_at DATETIME(3) NOT NULL,
      provenance ENUM('CURRENT','LAST_KNOWN') NOT NULL,
      PRIMARY KEY (id),
      KEY idx_emergency_locations_event (event_id, received_at, id),
      CONSTRAINT fk_emergency_locations_event FOREIGN KEY (event_id) REFERENCES emergency_events (id),
      CONSTRAINT fk_emergency_locations_device FOREIGN KEY (device_id) REFERENCES devices (id)
    ) ${TABLE_OPTIONS}`);

    // Per-target outcome, so a retried alert job only re-sends what has not gone out yet.
    await q.query(`CREATE TABLE emergency_deliveries (
      event_id ${ID} NOT NULL,
      target_key VARCHAR(80) CHARACTER SET ascii NOT NULL,
      channel ENUM('PUSH','IN_APP') NOT NULL,
      status ENUM('SUBMITTED','UNSUPPORTED','GONE','RETRY') NOT NULL,
      attempts INT NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (event_id, target_key, channel),
      CONSTRAINT fk_emergency_deliveries_event FOREIGN KEY (event_id) REFERENCES emergency_events (id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'emergency_deliveries',
      'emergency_locations',
      'emergency_responses',
      'emergency_events',
      'emergency_recipients',
    ]) {
      await q.query(`DROP TABLE ${table}`);
    }
    await q.query('ALTER TABLE jobs DROP INDEX idx_jobs_due, ADD KEY idx_jobs_status_run_at (status, run_at)');
    await q.query('ALTER TABLE jobs DROP COLUMN priority');
  }
}
