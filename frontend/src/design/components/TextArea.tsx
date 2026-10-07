"use client";

import type { TextareaHTMLAttributes } from "react";
import { t } from "@/i18n/vi";
import { cn } from "../cn";
import { Field, controlClass } from "./Field";

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
}

export function TextArea({ label, helper, error, optional, required, maxLength, value, className, rows = 3, ...rest }: TextAreaProps) {
  const length = typeof value === "string" ? value.length : 0;
  return (
    <Field label={label} helper={helper} error={error} optional={optional} required={required}>
      {(control) => (
        <span className="relative block">
          <textarea {...control} required={required} maxLength={maxLength} value={value} rows={rows} className={cn(controlClass, "resize-y py-2.5", maxLength && "pb-6", className)} {...rest} />
          {maxLength ? (
            <span aria-hidden className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted">
              {t("ui.charCount", { n: length, max: maxLength })}
            </span>
          ) : null}
        </span>
      )}
    </Field>
  );
}
