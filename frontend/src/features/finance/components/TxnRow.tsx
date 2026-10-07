import { Link2 } from "lucide-react";
import type { FinanceTxn } from "@/core/model/finance";
import { cn } from "@/design/cn";
import { t } from "@/i18n/vi";
import { categoryTone, signedAmount } from "../model/finance-view";
import { CATEGORY_ICON } from "./category-icon";

export const txnTitle = (txn: FinanceTxn) => txn.note || t(`finance.categories.${txn.category}`);
export const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function TxnAmount({ txn, className }: { txn: FinanceTxn; className?: string }) {
  return (
    <span className={cn("whitespace-nowrap font-bold tabular-nums", txn.type === "EXPENSE" ? "text-danger" : txn.type === "INCOME" ? "text-success" : "text-text", className)} data-testid="txn-amount">
      {signedAmount(txn)}
    </span>
  );
}

export function TxnIcon({ txn }: { txn: FinanceTxn }) {
  const Icon = CATEGORY_ICON[txn.category];
  const tone = categoryTone(txn.category);
  return (
    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5" style={{ background: `var(--cat-${tone}-bg)`, color: `var(--cat-${tone}-dot)` }}>
      <Icon />
    </span>
  );
}

/** "Giao dịch gần đây" row: icon, title + date/category, signed amount (red out, green in). */
export function TxnRow({ txn, memberName }: { txn: FinanceTxn; memberName?: string }) {
  const meta = [shortDate(txn.date), t(`finance.categories.${txn.category}`), memberName].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-3 py-2.5" data-testid="txn-row">
      <TxnIcon txn={txn} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-semibold text-text">
          <span className="truncate">{txnTitle(txn)}</span>
          {txn.itemId ? <Link2 aria-label={t("finance.txn.linked")} className="size-3.5 shrink-0 text-muted" /> : null}
        </p>
        <p className="truncate text-xs text-muted">{meta}</p>
      </div>
      <TxnAmount txn={txn} className="text-sm" />
    </div>
  );
}
