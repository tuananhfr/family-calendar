import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'magic_link_tokens' })
export class MagicLinkTokenEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'token_hash', type: 'char', length: 64 }) tokenHash: string;
  @Column({ type: 'varchar', length: 254 }) email: string;
  @Column({ type: 'varchar', length: 32 }) purpose: string;
  /** Actor that requested the link; only that Actor may redeem it. */
  @Column({ name: 'actor_id', type: 'char', length: 36, nullable: true }) actorId: string | null;
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt: Date;
  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }) usedAt: Date | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
