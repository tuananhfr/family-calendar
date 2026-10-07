import { Column, Entity, PrimaryColumn } from 'typeorm';

/** One repayment of a loan; rows are rewritten with the loan payload. */
@Entity({ name: 'finance_loan_payments' })
export class FinanceLoanPaymentEntity {
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'loan_id', type: 'char', length: 36 }) loanId: string;
  @PrimaryColumn({ type: 'smallint', unsigned: true }) position: number;
  @Column({ type: 'date' }) date: string;
  /** Integer VND as a decimal string. */
  @Column({ type: 'decimal', precision: 15, scale: 0 }) amount: string;
}
