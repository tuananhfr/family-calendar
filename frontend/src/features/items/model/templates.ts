import type { Category, ItemKind, Preset, Priority } from "@/core/model/common";
import { defaultsForPreset } from "@/core/model/item";
import { isLocalDate } from "@/core/time/local-date";
import type { ItemFormValues } from "./form-to-item";
import type { RepeatPreset } from "./repeat-presets";

/** System plan template (modules.md §15): static data, applied to the form, never saved by itself. */
export interface TemplateDef {
  key: string;
  title: string;
  kind: ItemKind;
  preset: Preset;
  category: Category;
  allDay: boolean;
  startTime?: string;
  durationMinutes?: number;
  repeat: RepeatPreset;
  checklist: string[];
  reminderOffsets: number[];
  reminderOffsetMonths?: number[];
  priority?: Priority;
  description?: string;
}

const DAY = 1440;

// Order and titles follow ui-ux.md /mau-ke-hoach.
export const SYSTEM_TEMPLATES: readonly TemplateDef[] = [
  {
    key: "PARENT_MEETING",
    title: "Họp phụ huynh",
    kind: "EVENT",
    preset: "APPOINTMENT",
    category: "STUDY",
    allDay: false,
    startTime: "08:00",
    durationMinutes: 90,
    repeat: { kind: "NONE" },
    checklist: ["Sổ liên lạc", "Câu hỏi cho giáo viên"],
    reminderOffsets: [DAY, 60],
  },
  {
    key: "HEALTH_CHECKUP",
    title: "Khám sức khỏe",
    kind: "EVENT",
    preset: "APPOINTMENT",
    category: "HEALTH",
    allDay: false,
    startTime: "08:00",
    durationMinutes: 60,
    repeat: { kind: "NONE" },
    checklist: ["Thẻ bảo hiểm y tế", "Sổ khám bệnh", "Kết quả khám lần trước"],
    reminderOffsets: [DAY, 120],
  },
  {
    key: "BIRTHDAY",
    title: "Sinh nhật",
    kind: "EVENT",
    preset: "BIRTHDAY",
    category: "SPECIAL",
    allDay: true,
    repeat: { kind: "YEARLY" },
    checklist: ["Đặt bánh", "Chuẩn bị quà"],
    reminderOffsets: [7 * DAY, DAY],
  },
  {
    key: "TRIP",
    title: "Du lịch / Nghỉ lễ",
    kind: "EVENT",
    preset: "EVENT",
    category: "FAMILY",
    allDay: true,
    repeat: { kind: "NONE" },
    checklist: ["Đặt vé", "Đặt chỗ ở", "Chuẩn bị hành lý", "Giấy tờ tùy thân"],
    reminderOffsets: [3 * DAY],
  },
  {
    key: "EXTRACURRICULAR",
    title: "Hoạt động ngoại khóa",
    kind: "EVENT",
    preset: "EVENT",
    category: "ACTIVITY",
    allDay: false,
    startTime: "16:30",
    durationMinutes: 90,
    repeat: { kind: "WEEKLY" },
    checklist: ["Đồ dùng mang theo"],
    reminderOffsets: [30],
  },
  {
    key: "TUTORING",
    title: "Lịch học thêm",
    kind: "EVENT",
    preset: "TIMETABLE",
    category: "STUDY",
    allDay: false,
    startTime: "18:00",
    durationMinutes: 90,
    repeat: { kind: "WEEKLY" },
    checklist: [],
    reminderOffsets: [30],
  },
  {
    key: "DOCUMENT_EXPIRY",
    title: "Đến hạn giấy tờ",
    kind: "REMINDER",
    preset: "DOCUMENT",
    category: "DOCUMENT",
    allDay: true,
    repeat: { kind: "NONE" },
    checklist: ["Chuẩn bị ảnh thẻ", "Bản sao giấy tờ cũ"],
    // reminders.md Giấy tờ: 6 months / 3 months / 30 days / 7 days / 1 day.
    reminderOffsetMonths: [6, 3],
    reminderOffsets: [30 * DAY, 7 * DAY, DAY],
    priority: "HIGH",
  },
  {
    key: "FAMILY_EVENT",
    title: "Sự kiện gia đình",
    kind: "EVENT",
    preset: "EVENT",
    category: "FAMILY",
    allDay: false,
    startTime: "18:00",
    durationMinutes: 120,
    repeat: { kind: "NONE" },
    checklist: [],
    reminderOffsets: [DAY],
  },
  {
    key: "MEDICATION",
    title: "Uống thuốc",
    kind: "REMINDER",
    preset: "MEDICATION",
    category: "HEALTH",
    allDay: false,
    startTime: "07:00",
    repeat: { kind: "DAILY" },
    checklist: [],
    reminderOffsets: [0],
    priority: "HIGH",
  },
  {
    key: "RECURRING_PAYMENT",
    title: "Thanh toán định kỳ",
    kind: "REMINDER",
    preset: "PAYMENT",
    category: "FINANCE",
    allDay: false,
    startTime: "09:00",
    repeat: { kind: "MONTHLY" },
    checklist: [],
    reminderOffsets: [3 * DAY, 0],
  },
];

export function templateByKey(key: string): TemplateDef | undefined {
  return SYSTEM_TEMPLATES.find((t) => t.key === key);
}

function addMinutesClamped(time: string, minutes: number): string {
  const total = Math.min(Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Fills the form from a template; what the user already typed (title, date, members, time) wins. The template's
 * preset decides category and audience so a medication template is never left family-wide by an earlier choice.
 */
export function applyTemplate(t: TemplateDef, base: Partial<ItemFormValues>): ItemFormValues {
  if (!base.date || !isLocalDate(base.date)) throw new RangeError("applyTemplate needs a valid date");
  const defaults = defaultsForPreset(t.kind, t.preset);
  const startTime = t.allDay ? undefined : (base.startTime ?? t.startTime);
  const endTime = startTime && t.durationMinutes ? addMinutesClamped(startTime, t.durationMinutes) : undefined;
  const values: ItemFormValues = {
    ...base,
    kind: t.kind,
    preset: t.preset,
    category: t.category,
    title: base.title?.trim() ? base.title : t.title,
    description: base.description ?? t.description,
    allDay: t.allDay,
    date: base.date,
    startTime,
    endTime,
    repeat: t.repeat,
    memberIds: base.memberIds ?? [],
    priority: t.priority ?? base.priority ?? "MEDIUM",
    checklist: [...t.checklist],
    createReminder: t.reminderOffsets.length > 0 || (t.reminderOffsetMonths?.length ?? 0) > 0,
    reminderOffsets: [...t.reminderOffsets],
    reminderOffsetMonths: t.reminderOffsetMonths ? [...t.reminderOffsetMonths] : undefined,
    channels: base.channels ?? ["IN_APP"],
    showOnCalendar: base.showOnCalendar ?? true,
    calendarSystem: base.calendarSystem ?? "SOLAR",
    attachments: base.attachments ?? [],
    // Health visits are SENSITIVE and start private like medication (domain-model.md "Scope và data class").
    sharingScope: t.category === "HEALTH" ? "PRIVATE" : defaults.sharingScope,
    templateKey: t.key,
  };
  if (values.endDate === undefined) delete values.endDate;
  return values;
}
