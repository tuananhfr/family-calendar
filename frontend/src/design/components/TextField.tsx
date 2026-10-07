"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";
import { Field, controlClass } from "./Field";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  icon?: ReactNode;
  fieldClassName?: string;
}

export function TextField({ label, helper, error, optional, required, icon, fieldClassName, className, ...input }: TextFieldProps) {
  return (
    <Field label={label} helper={helper} error={error} optional={optional} required={required} className={fieldClassName}>
      {(control) => (
        <span className="relative flex items-center">
          {icon ? <span aria-hidden className="pointer-events-none absolute left-3 text-muted [&_svg]:size-4">{icon}</span> : null}
          <input {...control} required={required} className={cn(controlClass, icon && "pl-9", className)} {...input} />
        </span>
      )}
    </Field>
  );
}
