import { EXPENSE_CATEGORIES } from '../domain-enums';
import { money, oneOf, yearMonth } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

export const financeBudgetDefinition = new TableResource({
  type: 'finance_budget',
  table: 'finance_budgets',
  access: capabilityRules('finance'),
  fields: [
    { key: 'month', column: 'month', codec: yearMonth },
    { key: 'category', column: 'category', codec: oneOf(EXPENSE_CATEGORIES) },
    { key: 'limitAmount', column: 'limit_amount', codec: money({ positive: true }) },
  ],
});
