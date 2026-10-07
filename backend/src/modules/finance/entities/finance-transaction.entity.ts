import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'finance_transactions' })
export class FinanceTransactionEntity extends ResourceEntity {
  @Column({ type: 'enum', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] }) type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  @Column({ type: 'decimal', precision: 15, scale: 0 }) amount: string;
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
      'SALARY',
      'BONUS',
      'BUSINESS',
      'TRANSFER',
    ],
  })
  category: string;
  @Column({ type: 'date' }) date: string;
  @Column({ name: 'member_id', type: 'char', length: 36, nullable: true }) memberId: string | null;
  @Column({ name: 'account_id', type: 'char', length: 36, nullable: true }) accountId: string | null;
  @Column({ name: 'to_account_id', type: 'char', length: 36, nullable: true }) toAccountId: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
  /** PAYMENT reminder this expense was recorded from. */
  @Column({ name: 'item_id', type: 'char', length: 36, nullable: true }) itemId: string | null;
  @Column({ name: 'attachment_file_id', type: 'char', length: 36, nullable: true }) attachmentFileId: string | null;
}
