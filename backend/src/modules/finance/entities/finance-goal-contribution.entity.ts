import { Column, Entity, PrimaryColumn } from 'typeorm';

/** One contribution to a goal; rows are rewritten with the goal payload. */
@Entity({ name: 'finance_goal_contributions' })
export class FinanceGoalContributionEntity {
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'goal_id', type: 'char', length: 36 }) goalId: string;
  @PrimaryColumn({ type: 'smallint', unsigned: true }) position: number;
  @Column({ type: 'date' }) date: string;
  /** Integer VND as a decimal string. */
  @Column({ type: 'decimal', precision: 15, scale: 0 }) amount: string;
}
