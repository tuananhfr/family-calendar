export type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

export const TONE_SOFT: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-muted border border-border",
};
