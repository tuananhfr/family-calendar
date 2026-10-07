import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'finance_budgets' })
export class FinanceBudgetEntity extends ResourceEntity {
  /** 'YYYY-MM' */
  @Column({ type: 'char', length: 7 }) month: string;
  @Column({
    type: 'enum',
    enum: [
      'FOOD',
      'EDUCATION',
      'LIVING',
      'HEALTH',
      'ENTERTAINMENT',
      'TRANSPORT',
      'HOUSING',
      'BILLS',
      'SHOPPING',
      'OTHER',
    ],
  })
  category: string;
  @Column({ name: 'limit_amount', type: 'decimal', precision: 15, scale: 0 }) limitAmount: string;
}
