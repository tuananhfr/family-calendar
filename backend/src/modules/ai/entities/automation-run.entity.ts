import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AUTOMATION_RULES } from '../../sync/domain-enums';

export const AUTOMATION_RUN_STATUSES = ['DONE', 'FAILED'] as const;

@Entity({ name: 'automation_runs' })
export class AutomationRunEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'automation_id', type: 'char', length: 36 }) automationId: string;
  @Column({ name: 'rule_key', type: 'enum', enum: AUTOMATION_RULES }) ruleKey: (typeof AUTOMATION_RULES)[number];
  @Column({ name: 'run_key', type: 'varchar', length: 191 }) runKey: string;
  @Column({ type: 'enum', enum: AUTOMATION_RUN_STATUSES }) status: (typeof AUTOMATION_RUN_STATUSES)[number];
  /** Notifications or tasks produced; counts only, never content. */
  @Column({ name: 'result_count', type: 'int' }) resultCount: number;
  @Column({ name: 'ran_at', type: 'datetime', precision: 3 }) ranAt: Date;
}
