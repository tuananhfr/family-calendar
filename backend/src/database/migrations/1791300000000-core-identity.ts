import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class CoreIdentity1791300000000 implements MigrationInterface {
  name = 'CoreIdentity1791300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE actors (
      id ${ID} NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE devices (
      id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      label VARCHAR(100) NULL,
      user_agent_hash ${HASH} NULL,
      status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME(3) NOT NULL,
      revoked_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      KEY idx_devices_actor (actor_id),
      CONSTRAINT fk_devices_actor FOREIGN KEY (actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE sessions (
      id ${ID} NOT NULL,
      token_hash ${HASH} NOT NULL,
      actor_id ${ID} NOT NULL,
      device_id ${ID} NOT NULL,
      csrf_hash ${HASH} NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      revoked_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      last_seen_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sessions_token_hash (token_hash),
      KEY idx_sessions_device (device_id),
      KEY idx_sessions_actor (actor_id),
      CONSTRAINT fk_sessions_actor FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT fk_sessions_device FOREIGN KEY (device_id) REFERENCES devices (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE accounts (
      id ${ID} NOT NULL,
      email VARCHAR(254) NOT NULL,
      email_verified_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_accounts_email (email)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE account_links (
      account_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      linked_at DATETIME(3) NOT NULL,
      unlinked_at DATETIME(3) NULL,
      PRIMARY KEY (account_id, actor_id),
      KEY idx_account_links_actor (actor_id),
      CONSTRAINT fk_account_links_account FOREIGN KEY (account_id) REFERENCES accounts (id),
      CONSTRAINT fk_account_links_actor FOREIGN KEY (actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    // space_id gets its foreign key once the spaces table exists (spaces-roles-memberships migration).
    await q.query(`CREATE TABLE recovery_credentials (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      secret_hash ${HASH} NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_recovery_secret_hash (secret_hash),
      KEY idx_recovery_space_actor (space_id, actor_id),
      CONSTRAINT fk_recovery_actor FOREIGN KEY (actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE magic_link_tokens (
      id ${ID} NOT NULL,
      token_hash ${HASH} NOT NULL,
      email VARCHAR(254) NOT NULL,
      purpose VARCHAR(32) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_magic_link_token_hash (token_hash),
      KEY idx_magic_link_email (email, created_at)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE audit_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      space_id ${ID} NULL,
      actor_id ${ID} NULL,
      device_id ${ID} NULL,
      action VARCHAR(64) NOT NULL,
      resource_type VARCHAR(40) NULL,
      resource_id ${ID} NULL,
      revision BIGINT UNSIGNED NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_audit_space_created (space_id, created_at),
      KEY idx_audit_resource (space_id, resource_type, resource_id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      type VARCHAR(64) NOT NULL,
      dedupe_key VARCHAR(191) NULL,
      payload JSON NOT NULL,
      run_at DATETIME(3) NOT NULL,
      status ENUM('SCHEDULED','LEASED','DONE','RETRY_WAIT','CANCELED','FAILED') NOT NULL DEFAULT 'SCHEDULED',
      attempts INT NOT NULL DEFAULT 0,
      lease_owner VARCHAR(64) NULL,
      lease_until DATETIME(3) NULL,
      last_error_code VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_jobs_dedupe_key (dedupe_key),
      KEY idx_jobs_status_run_at (status, run_at),
      CONSTRAINT chk_jobs_payload_json CHECK (JSON_VALID(payload))
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'jobs',
      'audit_events',
      'magic_link_tokens',
      'recovery_credentials',
      'account_links',
      'accounts',
      'sessions',
      'devices',
      'actors',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
