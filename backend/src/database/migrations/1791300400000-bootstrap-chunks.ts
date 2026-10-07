import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class BootstrapChunks1791300400000 implements MigrationInterface {
  name = 'BootstrapChunks1791300400000';

  public async up(q: QueryRunner): Promise<void> {
    // One row per applied chunk so a resent chunk is answered without writing again.
    await q.query(`CREATE TABLE bootstrap_chunks (
      chunk_id ${ID} NOT NULL,
      space_id ${ID} NOT NULL,
      payload_hash ${HASH} NOT NULL,
      accepted INT UNSIGNED NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (chunk_id),
      KEY idx_bootstrap_chunks_space (space_id),
      CONSTRAINT fk_bootstrap_chunks_space FOREIGN KEY (space_id) REFERENCES spaces (id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS bootstrap_chunks');
  }
}
