import { Column, Entity, PrimaryColumn } from 'typeorm';

export const EMERGENCY_RESPONSE_KINDS = ['ACKNOWLEDGED', 'RESPONDING'] as const;
export type EmergencyResponseKind = (typeof EMERGENCY_RESPONSE_KINDS)[number];

@Entity({ name: 'emergency_responses' })
export class EmergencyResponseEntity {
  @PrimaryColumn({ name: 'event_id', type: 'char', length: 36 }) eventId: string;
  @PrimaryColumn({ name: 'responder_actor_id', type: 'char', length: 36 }) responderActorId: string;
  @Column({ name: 'responder_member_id', type: 'char', length: 36, nullable: true }) responderMemberId: string | null;
  @Column({ type: 'enum', enum: EMERGENCY_RESPONSE_KINDS }) kind: EmergencyResponseKind;
  @Column({ name: 'operation_id', type: 'char', length: 36 }) operationId: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
