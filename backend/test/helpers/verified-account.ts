import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
export async function seedVerifiedAccount(ds: DataSource, actorId: string, email = actorId + '@example.com') {
  const id = randomUUID();
  await ds.query('INSERT INTO accounts (id, email, email_verified_at, created_at) VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))', [id, email]);
  await ds.query('INSERT INTO account_links (account_id, actor_id, linked_at) VALUES (?, ?, UTC_TIMESTAMP(3))', [id, actorId]);
  return id;
}
