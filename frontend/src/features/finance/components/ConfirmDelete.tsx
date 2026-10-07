"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Dialog, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { deleteFinanceRecord, type FinanceType } from "../model/finance-writes";

export interface DeleteRequest {
  type: FinanceType;
  id: string;
  /** Already-formatted question, e.g. "Xóa giao dịch “Tiền điện”?". */
  question: string;
  done: string;
}

export function ConfirmDelete({ request, onClose }: { request: DeleteRequest; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await deleteFinanceRecord(request.type, request.id);
      toast(request.done, "success");
      onClose();
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
      onOpenChange={(o) => !o && onClose()}
      icon={<Trash2 />}
      title={t("common.delete")}
      description={request.question}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => void remove()} loading={busy}>
            {t("common.delete")}
          </Button>
        </>
      }
    />
  );
}
