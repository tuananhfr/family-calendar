import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class Invites1791300500000 implements MigrationInterface {
  name = 'Invites1791300500000';

  public async up(q: QueryRunner): Promise<void> {
    // Only the sha256 of the token is stored; the token itself is shown once to the issuer.
    await q.query(`CREATE TABLE invites (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      issued_by_actor_id ${ID} NOT NULL,
      token_hash ${HASH} NOT NULL,
      max_uses SMALLINT UNSIGNED NOT NULL,
      uses SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      approval_policy ENUM('APPROVAL_REQUIRED') NOT NULL,
      proposed_role_key VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NULL,
      email VARCHAR(254) NULL,
      status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      revoked_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_invites_token (token_hash),
      KEY idx_invites_space (space_id, created_at),
      KEY idx_invites_email (email),
      CONSTRAINT fk_invites_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_invites_issuer FOREIGN KEY (issued_by_actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    await q.query(`CREATE TABLE join_requests (
      id ${ID} NOT NULL,
      invite_id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      actor_id ${ID} NOT NULL,
      device_id ${ID} NOT NULL,
      display_name VARCHAR(50) NOT NULL,
      proposed_profile ENUM('PARENT','SENIOR','CHILD') NULL,
      member_id ${ID} NULL,
      status ENUM('PENDING_GUARDIAN','PENDING','APPROVED','REJECTED') NOT NULL,
      guardian_actor_id ${ID} NULL,
      approved_member_id ${ID} NULL,
      decided_by_actor_id ${ID} NULL,
      decided_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_join_requests_invite_actor (invite_id, actor_id),
      KEY idx_join_requests_space (space_id, status),
      KEY idx_join_requests_actor (actor_id),
      CONSTRAINT fk_join_requests_invite FOREIGN KEY (invite_id) REFERENCES invites (id),
      CONSTRAINT fk_join_requests_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_join_requests_actor FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT fk_join_requests_device FOREIGN KEY (device_id) REFERENCES devices (id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS join_requests');
    await q.query('DROP TABLE IF EXISTS invites');
  }
}
