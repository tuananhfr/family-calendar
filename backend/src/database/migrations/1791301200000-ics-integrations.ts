import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class IcsIntegrations1791301200000 implements MigrationInterface {
  name = 'IcsIntegrations1791301200000';

  public async up(q: QueryRunner): Promise<void> {
    // Only the SHA-256 of the subscription token is stored; the URL is shown once at creation.
    await q.query(`CREATE TABLE ics_feeds (
      id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      created_by_actor_id ${ID} NOT NULL,
      token_hash ${HASH} NOT NULL,
      label VARCHAR(50) NULL,
      include_child_names TINYINT(1) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      last_used_at DATETIME(3) NULL,
      revoked_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ics_feeds_token_hash (token_hash),
      KEY idx_ics_feeds_space (space_id, revoked_at),
      CONSTRAINT fk_ics_feeds_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT fk_ics_feeds_actor FOREIGN KEY (created_by_actor_id) REFERENCES actors (id)
    ) ${TABLE_OPTIONS}`);

    // modules.md §12: the frame for third-party connections; V1 ships none, so no row is ever written yet.
    await q.query(`CREATE TABLE integrations (
      space_id ${ID} NOT NULL,
      provider ENUM('GOOGLE_CALENDAR','GOOGLE_DRIVE','ZALO','GMAIL','SMS','OPEN_API') NOT NULL,
      status ENUM('CONNECTED','ERROR') NOT NULL,
      config_json JSON NULL,
      connected_by_actor_id ${ID} NULL,
      connected_at DATETIME(3) NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, provider),
      CONSTRAINT fk_integrations_space FOREIGN KEY (space_id) REFERENCES spaces (id),
      CONSTRAINT chk_integrations_config CHECK (config_json IS NULL OR JSON_VALID(config_json))
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE integrations');
    await q.query('DROP TABLE ics_feeds');
  }
}
