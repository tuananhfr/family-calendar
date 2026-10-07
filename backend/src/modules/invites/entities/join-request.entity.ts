import { Column, Entity, PrimaryColumn } from 'typeorm';

export type JoinRequestStatus = 'PENDING_GUARDIAN' | 'PENDING' | 'APPROVED' | 'REJECTED';

/** A device's request to join through an invite; EXPIRED is derived from the invite, never stored. */
@Entity({ name: 'join_requests' })
export class JoinRequestEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'invite_id', type: 'char', length: 36 }) inviteId: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'device_id', type: 'char', length: 36 }) deviceId: string;
  @Column({ name: 'display_name', type: 'varchar', length: 50 }) displayName: string;
  @Column({ name: 'proposed_profile', type: 'enum', enum: ['PARENT', 'SENIOR', 'CHILD'], nullable: true })
  proposedProfile: 'PARENT' | 'SENIOR' | 'CHILD' | null;
  @Column({ name: 'member_id', type: 'char', length: 36, nullable: true }) memberId: string | null;
  @Column({ type: 'enum', enum: ['PENDING_GUARDIAN', 'PENDING', 'APPROVED', 'REJECTED'] }) status: JoinRequestStatus;
  @Column({ name: 'guardian_actor_id', type: 'char', length: 36, nullable: true }) guardianActorId: string | null;
  @Column({ name: 'approved_member_id', type: 'char', length: 36, nullable: true }) approvedMemberId: string | null;
  @Column({ name: 'decided_by_actor_id', type: 'char', length: 36, nullable: true }) decidedByActorId: string | null;
  @Column({ name: 'decided_at', type: 'datetime', precision: 3, nullable: true }) decidedAt: Date | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
