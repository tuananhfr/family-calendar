"use client";

import { useId, useState, type ReactNode } from "react";
import { StorageFullError } from "@/core/repo/write";
import { Button, Dialog, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { HealthFormError } from "../model/health-writes";

export type FieldErrors = Record<string, string>;

// validateMetric already returns Vietnamese text; schema issues come as codes, and t() throws on unknown keys.
function errorText(code: string): string {
  if (/\s/.test(code)) return code;
  try {
    return t(`health.errors.${code}`);
  } catch {
    return t("health.errors.UNKNOWN");
  }
}

/** Dialog + form shell for health forms: field errors from HealthFormError, a toast for anything unexpected. */
export function HealthFormDialog({
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
  /** Resolve with the success toast text; throw HealthFormError for field problems. */
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
      if (e instanceof HealthFormError) setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, errorText(v)])));
      else if (e instanceof StorageFullError) toast(t("storage.upload.full"), "error");
      else {
        console.error(e);
        toast(t("health.errors.UNKNOWN"), "error");
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
