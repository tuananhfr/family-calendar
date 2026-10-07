import { addMonthsClamped } from '../../../common/time/month-offset';
import { decimal, int, localDate, money, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

export const financeSavingDefinition = new TableResource({
  type: 'finance_saving',
  table: 'finance_savings',
  access: capabilityRules('finance'),
  // The server always recomputes it; a client value would only be a stale copy.
  ignoredKeys: ['maturityDate'],
  fields: [
    { key: 'name', column: 'name', codec: text(100) },
    { key: 'bank', column: 'bank', codec: text(100, 0), optional: true },
    { key: 'principal', column: 'principal', codec: money({ positive: true }) },
    { key: 'ratePercent', column: 'rate_percent', codec: decimal(0, 100, 2) },
    { key: 'startDate', column: 'start_date', codec: localDate },
    { key: 'termMonths', column: 'term_months', codec: int(1, 600) },
  ],
  derive: (columns) => ({
    maturity_date: addMonthsClamped(columns.start_date as string, columns.term_months as number),
  }),
  extraWire: (row) => ({ maturityDate: row.maturity_date }),
});
