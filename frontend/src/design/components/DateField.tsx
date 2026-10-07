"use client";

import { CalendarDays } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

/** Native date input: value is always 'YYYY-MM-DD', matching how all-day dates are stored. */
export function DateField(props: Omit<TextFieldProps, "type" | "icon">) {
  return <TextField type="date" icon={<CalendarDays />} {...props} />;
}
