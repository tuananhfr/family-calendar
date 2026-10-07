import { Activity, Droplet, Heart, HeartPulse, Moon, Ruler, Scale, Thermometer, type LucideIcon } from "lucide-react";
import type { HealthMetricType } from "@/core/model/health";

export const METRIC_ICON: Record<HealthMetricType, LucideIcon> = {
  WEIGHT: Scale,
  HEIGHT: Ruler,
  BLOOD_PRESSURE: HeartPulse,
  HEART_RATE: Heart,
  SLEEP: Moon,
  BLOOD_GLUCOSE: Droplet,
  TEMPERATURE: Thermometer,
  CUSTOM: Activity,
};

// Category palette tones, matching IMG-F's tiles (blue scale, red pressure/pulse, indigo sleep).
export const METRIC_TONE: Record<HealthMetricType, string> = {
  WEIGHT: "study",
  HEIGHT: "document",
  BLOOD_PRESSURE: "health",
  HEART_RATE: "health",
  SLEEP: "special",
  BLOOD_GLUCOSE: "shopping",
  TEMPERATURE: "activity",
  CUSTOM: "other",
};
