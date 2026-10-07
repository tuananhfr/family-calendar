"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { hasLevel } from "@/core/access/evaluate";
import { Button, Dialog, toast } from "@/design/components";
import { usePaymentPrompt } from "@/features/items";
import { useAccess, useActiveSpace, useSpaceToday } from "@/features/members";
import { t } from "@/i18n/vi";
import { recordPaymentExpense } from "../model/finance-writes";
import { formatVnd, toMoney } from "../model/money";

/**
 * Mounted once in the app shell: after "Đã xong" on a PAYMENT reminder with an amount, asks before recording
 * (modules.md §7 — never automatic). Roles that can't edit finance are never asked.
 */
export function PaymentPromptHost() {
  const prompt = usePaymentPrompt((s) => s.prompt);
  const clear = usePaymentPrompt((s) => s.clear);
  const access = useAccess();
  const { space } = useActiveSpace();
  const today = useSpaceToday();
  const [busy, setBusy] = useState(false);
  const allowed = access ? hasLevel(access, "finance", "EDIT") : undefined;
  useEffect(() => {
    if (prompt && allowed === false) clear();
  }, [prompt, allowed, clear]);
  if (!prompt || !space || !allowed) return null;
  const amount = formatVnd(toMoney(prompt.amount));

  const record = async () => {
    setBusy(true);
    try {
      await recordPaymentExpense(space.id, prompt, today);
      toast(t("finance.prompt.saved", { amount }), "success");
      clear();
    } catch (e) {
      console.error(e);
      toast(t("finance.errors.UNKNOWN"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && clear()}
      icon={<Receipt />}
      title={t("finance.prompt.title")}
      description={t("finance.prompt.body", { title: prompt.title, amount })}
      footer={
        <>
          <Button variant="secondary" onClick={clear} disabled={busy}>
            {t("finance.prompt.no")}
          </Button>
          <Button onClick={() => void record()} loading={busy}>
            {t("finance.prompt.yes")}
          </Button>
        </>
      }
    />
  );
}
