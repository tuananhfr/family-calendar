import { Column, Entity, PrimaryColumn } from 'typeorm';

export const NOTIFICATION_TYPES = [
  'REMINDER_DUE',
  'INVITE',
  'JOIN_REQUEST',
  'SOS',
  'SYNC_CONFLICT',
  'BUDGET_ALERT',
  'AUTOMATION',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ type: 'enum', enum: NOTIFICATION_TYPES }) type: NotificationType;
  @Column({ name: 'resource_ref', type: 'json', nullable: true }) resourceRef: Record<string, unknown> | null;
  @Column({ name: 'title_safe', type: 'varchar', length: 200 }) titleSafe: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'read_at', type: 'datetime', precision: 3, nullable: true }) readAt: Date | null;
}
