import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Members a reminder rule notifies. */
@Entity({ name: 'reminder_recipients' })
export class ReminderRecipientEntity {
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'reminder_rule_id', type: 'char', length: 36 }) reminderRuleId: string;
  @PrimaryColumn({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
}
