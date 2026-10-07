import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ai_messages' })
export class AiMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) seq: string;
  @Column({ name: 'conversation_id', type: 'char', length: 36 }) conversationId: string;
  @Column({ type: 'enum', enum: ['user', 'assistant'] }) role: 'user' | 'assistant';
  @Column({ type: 'text' }) text: string;
  @Column({ type: 'json', nullable: true }) drafts: unknown[] | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
