import { Column, Entity, PrimaryColumn } from 'typeorm';

export type MembershipStatus = 'ACTIVE' | 'REMOVED';

@Entity({ name: 'memberships' })
export class MembershipEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'role_id', type: 'char', length: 36 }) roleId: string;
  @Column({ type: 'enum', enum: ['ACTIVE', 'REMOVED'] }) status: MembershipStatus;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
  @Column({ name: 'removed_at', type: 'datetime', precision: 3, nullable: true }) removedAt: Date | null;
}
