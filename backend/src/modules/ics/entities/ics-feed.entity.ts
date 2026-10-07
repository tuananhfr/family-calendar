import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'ics_feeds' })
export class IcsFeedEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'created_by_actor_id', type: 'char', length: 36 }) createdByActorId: string;
  @Column({ name: 'token_hash', type: 'char', length: 64 }) tokenHash: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) label: string | null;
  @Column({ name: 'include_child_names', type: 'boolean' }) includeChildNames: boolean;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'last_used_at', type: 'datetime', precision: 3, nullable: true }) lastUsedAt: Date | null;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt: Date | null;
}
