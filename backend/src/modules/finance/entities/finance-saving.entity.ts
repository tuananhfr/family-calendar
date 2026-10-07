import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'finance_savings' })
export class FinanceSavingEntity extends ResourceEntity {
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) bank: string | null;
  @Column({ type: 'decimal', precision: 15, scale: 0 }) principal: string;
  @Column({ name: 'rate_percent', type: 'decimal', precision: 5, scale: 2 }) ratePercent: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'term_months', type: 'smallint', unsigned: true }) termMonths: number;
  /** Computed server-side from start date + term (calendar months, clamped to month end). */
  @Column({ name: 'maturity_date', type: 'date' }) maturityDate: string;
}
