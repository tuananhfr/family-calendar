import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** Money columns are DECIMAL(15,0) VND, hydrated as strings so no amount goes through a float. */
@Entity({ name: 'finance_accounts' })
export class FinanceAccountEntity extends ResourceEntity {
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'enum', enum: ['CASH', 'BANK', 'EWALLET', 'OTHER'] }) type: 'CASH' | 'BANK' | 'EWALLET' | 'OTHER';
  @Column({ name: 'opening_balance', type: 'decimal', precision: 15, scale: 0 }) openingBalance: string;
}
