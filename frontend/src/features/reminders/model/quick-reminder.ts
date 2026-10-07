import { addDays, type LocalDate } from "@/core/time/local-date";
import type { LocalDateTime } from "@/core/time/zoned";
import type { ItemFormValues } from "@/features/items/model/form-to-item";
import type { RepeatPreset } from "@/features/items/model/repeat-presets";

export interface QuickReminderChoice {
  date?: LocalDate;
  /** 'HH:mm' from the time dropdown. */
  time?: string;
  repeat?: RepeatPreset;
}

/**
 * "Nhắc nhanh": the text is taken verbatim as the title (no natural-language parsing); date/time and repeat come
 * from the two dropdowns. Without a time it defaults to the next full hour; a one-off time already past today
 * moves to tomorrow unless a date was chosen explicitly.
 */
export function parseQuickReminder(text: string, now: LocalDateTime, choice: QuickReminderChoice = {}): ItemFormValues {
  const today = now.slice(0, 10);
  const hour = Number(now.slice(11, 13));
  let date = choice.date ?? today;
  let time = choice.time;
  if (!time) {
    const next = hour + 1;
    time = `${String(next % 24).padStart(2, "0")}:00`;
    if (next === 24 && !choice.date) date = addDays(today, 1);
  } else if (!choice.date && (!choice.repeat || choice.repeat.kind === "NONE") && `${today}T${time}` <= now) {
    date = addDays(today, 1);
  }
  return {
    kind: "REMINDER",
    preset: "REMEMBER",
    category: "OTHER",
    title: text.trim(),
    allDay: false,
    date,
    startTime: time,
    repeat: choice.repeat ?? { kind: "NONE" },
    memberIds: [],
    priority: "MEDIUM",
    checklist: [],
    createReminder: true,
    reminderOffsets: [0],
    channels: ["IN_APP"],
    showOnCalendar: true,
    calendarSystem: "SOLAR",
    attachments: [],
    sharingScope: "FAMILY_ALL",
  };
}
