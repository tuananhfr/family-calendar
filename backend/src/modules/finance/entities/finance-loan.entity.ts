import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** Payments live in finance_loan_payments. */
@Entity({ name: 'finance_loans' })
export class FinanceLoanEntity extends ResourceEntity {
  @Column({ type: 'enum', enum: ['BORROWED', 'LENT'] }) direction: 'BORROWED' | 'LENT';
  @Column({ type: 'varchar', length: 100 }) counterparty: string;
  @Column({ type: 'decimal', precision: 15, scale: 0 }) principal: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
}
