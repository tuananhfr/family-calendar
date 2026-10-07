import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'recovery_credentials' })
export class RecoveryCredentialEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'secret_hash', type: 'char', length: 64 }) secretHash: string;
  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true }) usedAt: Date | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
