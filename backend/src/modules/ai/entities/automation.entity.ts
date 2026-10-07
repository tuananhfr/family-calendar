import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** Fixed if-then rules run by the worker, no AI (modules.md §11). */
@Entity({ name: 'automations' })
export class AutomationEntity extends ResourceEntity {
  @Column({ name: 'rule_key', type: 'enum', enum: ['PAYMENT_DUE_REMINDER', 'WEEKLY_SUMMARY', 'EXAM_REVIEW_TASK'] })
  ruleKey: 'PAYMENT_DUE_REMINDER' | 'WEEKLY_SUMMARY' | 'EXAM_REVIEW_TASK';
  @Column({ type: 'boolean' }) enabled: boolean;
  @Column({ type: 'json' }) params: Record<string, number | string | boolean>;
  @Column({ name: 'last_run_at', type: 'datetime', precision: 3, nullable: true }) lastRunAt: Date | null;
}
