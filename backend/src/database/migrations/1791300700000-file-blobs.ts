import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, ID, TABLE_OPTIONS } from './ddl';

export class FileBlobs1791300700000 implements MigrationInterface {
  name = 'FileBlobs1791300700000';

  // Key material lives here, ciphertext on disk: neither alone reveals a file. storage_key changes on every
  // upload so a failed commit never leaves the row pointing at a half-replaced blob.
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE file_blobs (
      space_id ${ID} NOT NULL,
      file_id ${ID} NOT NULL,
      storage_key VARCHAR(200) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      size BIGINT UNSIGNED NOT NULL,
      sha256 ${HASH} NOT NULL,
      content_type VARCHAR(127) CHARACTER SET ascii NOT NULL,
      wrapped_key VARBINARY(64) NOT NULL,
      iv BINARY(12) NOT NULL,
      auth_tag BINARY(16) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (space_id, file_id),
      CONSTRAINT fk_file_blobs_file FOREIGN KEY (space_id, file_id) REFERENCES files (space_id, id)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE file_blobs');
  }
}
