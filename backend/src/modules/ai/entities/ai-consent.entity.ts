import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'ai_consents' })
export class AiConsentEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ type: 'varchar', length: 20 }) version: string;
  @Column({ name: 'allow_health', type: 'boolean' }) allowHealth: boolean;
  @Column({ name: 'accepted_at', type: 'datetime', precision: 3 }) acceptedAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
