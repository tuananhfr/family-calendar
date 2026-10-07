import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Invite link/QR; `uses` counts successful approvals, never mere requests. */
@Entity({ name: 'invites' })
export class InviteEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'issued_by_actor_id', type: 'char', length: 36 }) issuedByActorId: string;
  @Column({ name: 'token_hash', type: 'char', length: 64 }) tokenHash: string;
  @Column({ name: 'max_uses', type: 'smallint', unsigned: true }) maxUses: number;
  @Column({ type: 'smallint', unsigned: true }) uses: number;
  @Column({ name: 'approval_policy', type: 'enum', enum: ['APPROVAL_REQUIRED'] }) approvalPolicy: 'APPROVAL_REQUIRED';
  @Column({ name: 'proposed_role_key', type: 'varchar', length: 40, nullable: true }) proposedRoleKey: string | null;
  @Column({ type: 'varchar', length: 254, nullable: true }) email: string | null;
  @Column({ type: 'enum', enum: ['ACTIVE', 'REVOKED'] }) status: 'ACTIVE' | 'REVOKED';
  @Column({ name: 'expires_at', type: 'datetime', precision: 3 }) expiresAt: Date;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true }) revokedAt: Date | null;
}
