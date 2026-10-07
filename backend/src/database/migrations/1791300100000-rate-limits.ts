import type { MigrationInterface, QueryRunner } from 'typeorm';
import { HASH, TABLE_OPTIONS } from './ddl';

export class RateLimits1791300100000 implements MigrationInterface {
  name = 'RateLimits1791300100000';

  public async up(q: QueryRunner): Promise<void> {
    // rate_key = sha256(bucket:window:identifier) so IPs and emails are never stored.
    await q.query(`CREATE TABLE rate_limits (
      rate_key ${HASH} NOT NULL,
      window_start DATETIME(3) NOT NULL,
      count INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (rate_key, window_start),
      KEY idx_rate_limits_window (window_start)
    ) ${TABLE_OPTIONS}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS rate_limits');
  }
}
