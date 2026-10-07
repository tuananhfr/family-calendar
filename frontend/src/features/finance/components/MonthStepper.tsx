import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/design/components";
import { t } from "@/i18n/vi";
import { monthTitle, shiftMonth } from "../model/finance-view";

export function MonthStepper({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t("finance.month.label")}>
      <IconButton label={t("finance.month.prev")} icon={<ChevronLeft className="size-5" />} variant="outline" onClick={() => onChange(shiftMonth(month, -1))} />
      <p className="min-w-[9.5rem] text-center text-base font-bold text-text" aria-live="polite" data-testid="finance-month">
        {monthTitle(month)}
      </p>
      <IconButton label={t("finance.month.next")} icon={<ChevronRight className="size-5" />} variant="outline" onClick={() => onChange(shiftMonth(month, 1))} />
    </div>
  );
}
