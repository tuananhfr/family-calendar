import { Column, Entity, PrimaryColumn } from 'typeorm';

export type SpaceKind = 'FAMILY' | 'GROUP';
export type SpaceSharingState = 'INITIALIZING' | 'SHARED';

@Entity({ name: 'spaces' })
export class SpaceEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ type: 'enum', enum: ['FAMILY', 'GROUP'] }) kind: SpaceKind;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ name: 'time_zone', type: 'varchar', length: 64 }) timeZone: string;
  @Column({ name: 'sharing_state', type: 'enum', enum: ['INITIALIZING', 'SHARED'] }) sharingState: SpaceSharingState;
  @Column({ type: 'json' }) settings: Record<string, unknown>;
  /** Last sync_changes seq handed out in this Space. */
  @Column({ name: 'change_seq', type: 'bigint', unsigned: true }) changeSeq: string;
  /** Bumped on every role/membership change so clients know their visible set may have changed. */
  @Column({ name: 'policy_version', type: 'bigint', unsigned: true }) policyVersion: string;
  @Column({ name: 'created_by_actor_id', type: 'char', length: 36 }) createdByActorId: string;
  @Column({ type: 'bigint', unsigned: true }) revision: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
