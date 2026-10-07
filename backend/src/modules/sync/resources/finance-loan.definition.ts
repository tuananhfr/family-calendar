import { localDate, money, oneOf, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { datedAmountsChild } from './shared';

export const financeLoanDefinition = new TableResource({
  type: 'finance_loan',
  table: 'finance_loans',
  access: capabilityRules('finance'),
  fields: [
    { key: 'direction', column: 'direction', codec: oneOf(['BORROWED', 'LENT'] as const) },
    { key: 'counterparty', column: 'counterparty', codec: text(100) },
    { key: 'principal', column: 'principal', codec: money({ positive: true }) },
    { key: 'startDate', column: 'start_date', codec: localDate },
    { key: 'dueDate', column: 'due_date', codec: localDate, optional: true },
    { key: 'note', column: 'note', codec: text(500, 0), optional: true },
  ],
  children: [datedAmountsChild('payments', 'finance_loan_payments', 'loan_id', 500)],
  validate(_input, columns, e) {
    if (columns.due_date && (columns.due_date as string) < (columns.start_date as string)) {
      e.add('dueDate', 'DUE_BEFORE_START');
    }
  },
});
