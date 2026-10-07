import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** Contributions live in finance_goal_contributions. */
@Entity({ name: 'finance_goals' })
export class FinanceGoalEntity extends ResourceEntity {
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ name: 'target_amount', type: 'decimal', precision: 15, scale: 0 }) targetAmount: string;
  @Column({ type: 'date', nullable: true }) deadline: string | null;
}
