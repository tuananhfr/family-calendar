import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Visible to its creator only, like a PRIVATE record; purged after the retention period. */
@Entity({ name: 'ai_conversations' })
export class AiConversationEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
