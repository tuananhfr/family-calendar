import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ID, HASH, TABLE_OPTIONS } from './ddl';
export class SharedMedia1791301300000 implements MigrationInterface {
  name = 'SharedMedia1791301300000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE shared_media (
      space_id ${ID} NOT NULL, owner_kind ENUM('member','item') NOT NULL, owner_id ${ID} NOT NULL,
      asset_id ${ID} NOT NULL, storage_key VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      size BIGINT UNSIGNED NOT NULL, sha256 ${HASH} NOT NULL, content_type VARCHAR(127) CHARACTER SET ascii NOT NULL,
      wrapped_key VARBINARY(64) NOT NULL, iv BINARY(12) NOT NULL, auth_tag BINARY(16) NOT NULL,
      created_at DATETIME(3) NOT NULL, PRIMARY KEY (space_id, owner_kind, owner_id, asset_id),
      CONSTRAINT fk_shared_media_space FOREIGN KEY (space_id) REFERENCES spaces (id)
    ) ${TABLE_OPTIONS}`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE shared_media'); }
}
