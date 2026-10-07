"use client";

import { Clock } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

export function TimeField(props: Omit<TextFieldProps, "type" | "icon">) {
  return <TextField type="time" icon={<Clock />} step={300} {...props} />;
}
