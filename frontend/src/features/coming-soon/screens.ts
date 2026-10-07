import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Bot,
  Cake,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  FolderOpen,
  HeartPulse,
  House,
  ListChecks,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { IllustrationName } from "@/design/illustration-sizes";

export interface ScreenMeta {
  titleKey: string;
  icon: LucideIcon;
  illustration: IllustrationName;
}

export const SCREENS = {
  today: { titleKey: "nav.today", icon: House, illustration: "corner-calendar" },
  calendar: { titleKey: "nav.calendar", icon: CalendarDays, illustration: "corner-calendar" },
  upcoming: { titleKey: "nav.upcoming", icon: CalendarClock, illustration: "corner-reminders" },
  tasks: { titleKey: "nav.tasks", icon: ListChecks, illustration: "corner-tasks" },
  reminders: { titleKey: "nav.reminders", icon: Bell, illustration: "corner-reminders" },
  timetable: { titleKey: "nav.timetable", icon: BookOpen, illustration: "corner-timetable" },
  specialDays: { titleKey: "nav.specialDays", icon: Cake, illustration: "corner-add" },
  members: { titleKey: "nav.members", icon: Users, illustration: "corner-members" },
  addMember: { titleKey: "nav.addMember", icon: UserPlus, illustration: "corner-add-member" },
  groups: { titleKey: "nav.groups", icon: Share2, illustration: "corner-groups" },
  permissions: { titleKey: "nav.permissions", icon: ShieldCheck, illustration: "corner-permissions" },
  reports: { titleKey: "nav.reports", icon: ChartColumn, illustration: "corner-reports" },
  finance: { titleKey: "nav.finance", icon: Wallet, illustration: "corner-finance" },
  health: { titleKey: "nav.health", icon: HeartPulse, illustration: "corner-health" },
  storage: { titleKey: "nav.storage", icon: FolderOpen, illustration: "corner-storage" },
  assistant: { titleKey: "nav.assistant", icon: Bot, illustration: "corner-ai" },
  settings: { titleKey: "nav.settings", icon: Settings, illustration: "corner-settings" },
  templates: { titleKey: "nav.templates", icon: CalendarRange, illustration: "corner-add" },
  notifications: { titleKey: "nav.notifications", icon: Bell, illustration: "corner-reminders" },
  search: { titleKey: "nav.search", icon: Search, illustration: "corner-calendar" },
  onboarding: { titleKey: "nav.onboarding", icon: House, illustration: "corner-add-member" },
  join: { titleKey: "nav.join", icon: UserPlus, illustration: "corner-add-member" },
  sos: { titleKey: "nav.sos", icon: ShieldCheck, illustration: "corner-members" },
} satisfies Record<string, ScreenMeta>;

export type ScreenKey = keyof typeof SCREENS;
