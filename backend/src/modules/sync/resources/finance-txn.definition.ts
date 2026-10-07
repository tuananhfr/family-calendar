import { FINANCE_CATEGORIES, categoriesForTxnType } from '../domain-enums';
import { id, localDate, money, oneOf, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

export const financeTxnDefinition = new TableResource({
  type: 'finance_txn',
  table: 'finance_transactions',
  access: capabilityRules('finance'),
  fields: [
    { key: 'type', column: 'type', codec: oneOf(['INCOME', 'EXPENSE', 'TRANSFER'] as const) },
    { key: 'amount', column: 'amount', codec: money({ positive: true }) },
    { key: 'category', column: 'category', codec: oneOf(FINANCE_CATEGORIES) },
    { key: 'date', column: 'date', codec: localDate },
    { key: 'memberId', column: 'member_id', codec: id, optional: true },
    { key: 'accountId', column: 'account_id', codec: id, optional: true },
    { key: 'toAccountId', column: 'to_account_id', codec: id, optional: true },
    { key: 'note', column: 'note', codec: text(500, 0), optional: true },
    { key: 'itemId', column: 'item_id', codec: id, optional: true },
    { key: 'attachmentFileId', column: 'attachment_file_id', codec: id, optional: true },
  ],
  refs: [
    { key: 'memberId', table: 'members' },
    { key: 'accountId', table: 'finance_accounts' },
    { key: 'toAccountId', table: 'finance_accounts' },
    { key: 'itemId', table: 'items' },
    { key: 'attachmentFileId', table: 'files' },
  ],
  validate(_input, columns, e) {
    if (!categoriesForTxnType(columns.type as string).includes(columns.category as string)) {
      e.add('category', 'CATEGORY_NOT_IN_TYPE');
    }
    const from = columns.account_id;
    const to = columns.to_account_id;
    if (columns.type === 'TRANSFER' && (!from || !to || from === to)) e.add('toAccountId', 'TRANSFER_ACCOUNTS_INVALID');
  },
});
