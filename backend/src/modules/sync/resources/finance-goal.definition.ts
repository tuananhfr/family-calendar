import { localDate, money, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { datedAmountsChild } from './shared';

export const financeGoalDefinition = new TableResource({
  type: 'finance_goal',
  table: 'finance_goals',
  access: capabilityRules('finance'),
  fields: [
    { key: 'name', column: 'name', codec: text(100) },
    { key: 'targetAmount', column: 'target_amount', codec: money({ positive: true }) },
    { key: 'deadline', column: 'deadline', codec: localDate, optional: true },
  ],
  children: [datedAmountsChild('contributions', 'finance_goal_contributions', 'goal_id', 1000)],
});
