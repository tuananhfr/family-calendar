import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'emergency_recipients' })
export class EmergencyRecipientEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
  @Column({ name: 'created_by_actor_id', type: 'char', length: 36 }) createdByActorId: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
