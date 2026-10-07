"use client";

import { useId, type ReactNode } from "react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

export interface FieldProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label above, helper/error below, wired by id so assistive tech reads them with the control. */
export function Field({ label, required, optional, helper, error, className, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errId = `${id}-err`;
  const describedBy = [helper ? helpId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : null}
        {optional ? <span className="font-normal text-muted"> ({t("common.optional")})</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": required ? true : undefined })}
      {helper && !error ? (
        <p id={helpId} className="text-xs text-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const controlClass = cn(
  "min-h-[var(--touch-min)] w-full min-w-0 rounded-control border border-border-strong bg-surface px-3 text-sm text-text",
  "placeholder:text-muted hover:border-primary focus-visible:border-primary aria-invalid:border-danger disabled:bg-disabled disabled:text-disabled-text",
);
