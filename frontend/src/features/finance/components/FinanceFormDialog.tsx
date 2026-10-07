"use client";

import { useId, useState, type ReactNode } from "react";
import { StorageFullError } from "@/core/repo/write";
import { Button, Dialog, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { FinanceFormError } from "../model/finance-writes";

export type FieldErrors = Record<string, string>;

// t() throws on an unknown key; an unmapped code must still show a message, not break the submit handler.
export function financeErrorText(code: string): string {
  try {
    return t(`finance.errors.${code}`);
  } catch {
    return t("finance.errors.UNKNOWN");
  }
}

/**
 * Dialog + form shell shared by every finance form: one submit path, field errors from FinanceFormError,
 * a toast for anything unexpected (logged, never swallowed).
 */
export function FinanceFormDialog({
  title,
  icon,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  icon: ReactNode;
  submitLabel: string;
  onClose: () => void;
  /** Resolve with the success toast text; throw FinanceFormError for field problems. */
  onSubmit: () => Promise<string>;
  children: (errors: FieldErrors, clear: (field: string) => void) => ReactNode;
}) {
  const formId = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      toast(await onSubmit(), "success");
      onClose();
    } catch (e) {
      if (e instanceof FinanceFormError) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, financeErrorText(v)])));
      else if (e instanceof StorageFullError) toast(t("storage.upload.full"), "error");
      else {
        console.error(e);
        toast(t("finance.errors.UNKNOWN"), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      icon={icon}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {children(errors, (field) =>
          setErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
          }),
        )}
      </form>
    </Dialog>
  );
}
