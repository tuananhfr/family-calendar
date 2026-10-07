import { isLocalDate } from '../../../common/time/local-date';
import { OCCURRENCE_KEY_MAX } from '../domain-enums';
import { id, isPlainObject, money, plain, type Codec } from '../fields';
import type { ChildSpec, FieldSpec, RefSpec } from '../resource-definition';

export const occurrenceKeyCodec = plain(OCCURRENCE_KEY_MAX, 3);

/** Parent item reference shared by every item child; the parent must be live and in the same Space. */
export const itemIdField: FieldSpec = { key: 'itemId', column: 'item_id', codec: id };
export const itemRef: RefSpec = { key: 'itemId', table: 'items' };

/** Member id list kept in a join table (item_members, reminder_recipients). */
export function memberIdsChild(table: string, parentColumn: string, key = 'memberIds'): ChildSpec {
  return {
    key,
    table,
    parentColumn,
    item: id,
    max: 50,
    unique: true,
    orderBy: 'member_id',
    toColumns: (value) => ({ member_id: value }),
    fromRow: (row) => row.member_id,
  };
}

const positiveMoney = money({ positive: true });

const datedAmount: Codec<{ date: string; amount: string }> = {
  parse(v, path, e) {
    if (!isPlainObject(v) || Object.keys(v).some((k) => k !== 'date' && k !== 'amount')) return e.add(path, 'INVALID');
    if (!isLocalDate(v.date)) return e.add(`${path}.date`, 'INVALID_DATE');
    const amount = positiveMoney.parse(v.amount, `${path}.amount`, e);
    return typeof amount === 'string' ? { date: v.date, amount } : amount;
  },
  out: (raw) => raw,
};

/** Loan payments / goal contributions: ordered (date, amount) rows rewritten with the parent payload. */
export function datedAmountsChild(key: string, table: string, parentColumn: string, max: number): ChildSpec {
  return {
    key,
    table,
    parentColumn,
    item: datedAmount,
    max,
    orderBy: 'position',
    toColumns: (value, index) => {
      const v = value as { date: string; amount: string };
      return { position: index, date: v.date, amount: v.amount };
    },
    fromRow: (row) => ({ date: row.date, amount: String(row.amount) }),
  };
}
