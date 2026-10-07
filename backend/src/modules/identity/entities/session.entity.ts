import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Only SHA-256 hashes of the cookie and CSRF tokens are stored; raw tokens never reach the DB. */
@Entity({ name: 'sessions' })
export class SessionEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'token_hash', type: 'char', length: 64 }) tokenHash: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'device_id', type: 'char', length: 36 }) deviceId: string;
  @Column({ name: 'csrf_hash', type: 'char', length: 64 }) csrfHash: string;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt: Date | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'last_seen_at', type: 'datetime', precision: 3 }) lastSeenAt: Date;
}
