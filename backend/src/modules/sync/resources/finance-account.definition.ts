import { money, oneOf, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

export const financeAccountDefinition = new TableResource({
  type: 'finance_account',
  table: 'finance_accounts',
  access: capabilityRules('finance'),
  fields: [
    { key: 'name', column: 'name', codec: text(100) },
    { key: 'type', column: 'type', codec: oneOf(['CASH', 'BANK', 'EWALLET', 'OTHER'] as const) },
    { key: 'openingBalance', column: 'opening_balance', codec: money({ positive: false }) },
  ],
});
