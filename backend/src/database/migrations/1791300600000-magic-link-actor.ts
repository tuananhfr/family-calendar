import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ID } from './ddl';

export class MagicLinkActor1791300600000 implements MigrationInterface {
  name = 'MagicLinkActor1791300600000';

  // A link token only links the Actor that asked for it, so a forwarded email cannot attach someone else's actor.
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE magic_link_tokens ADD COLUMN actor_id ${ID} NULL AFTER purpose`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE magic_link_tokens DROP COLUMN actor_id');
  }
}
