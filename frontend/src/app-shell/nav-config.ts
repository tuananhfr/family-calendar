import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Bot,
  Cake,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChartColumn,
  FileDown,
  FileText,
  FolderOpen,
  HeartPulse,
  House,
  ListChecks,
  Pill,
  Plus,
  Settings,
  Share2,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
  CalendarRange,
} from "lucide-react";
import type { Capability } from "@/core/access/capabilities";
import { hasLevel, type AccessContext } from "@/core/access/evaluate";
import { t } from "@/i18n/vi";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: "tasksToday";
  /** Opens an overlay instead of navigating; href stays a real route for no-JS/deep-link fallback. */
  action?: "quickAdd" | "familySheet";
  /** Hidden unless the active role can at least VIEW it (a child profile never sees Tài chính). */
  capability?: Capability;
}

export const ROUTES = {
  landing: "/",
  today: "/hom-nay/",
  calendar: "/lich/",
  upcoming: "/sap-den-han/",
  tasks: "/viec/",
  reminders: "/nhac/",
  timetable: "/thoi-khoa-bieu/",
  specialDays: "/ngay-dac-biet/",
  members: "/thanh-vien/",
  addMember: "/thanh-vien/them/",
  groups: "/nhom/",
  permissions: "/quyen/",
  reports: "/bao-cao/",
  finance: "/tai-chinh/",
  health: "/suc-khoe/",
  storage: "/kho-luu-tru/",
  assistant: "/tro-ly/",
  settings: "/cai-dat/",
  templates: "/mau-ke-hoach/",
  onboarding: "/bat-dau/",
  join: "/tham-gia/",
  sos: "/sos/",
  notifications: "/thong-bao/",
  search: "/tim-kiem/",
  about: "/gioi-thieu/",
  terms: "/dieu-khoan/",
  privacy: "/quyen-rieng-tu/",
  contact: "/lien-he/",
  help: "/tro-giup/",
} as const;

const item = (key: string, labelKey: string, href: string, icon: LucideIcon, extra: Partial<NavItem> = {}): NavItem => ({ key, label: t(labelKey), href, icon, ...extra });

export const TOPNAV_ITEMS: NavItem[] = [
  item("today", "nav.today", ROUTES.today, House),
  item("calendar", "nav.calendar", ROUTES.calendar, CalendarDays),
  item("tasks", "nav.tasks", ROUTES.tasks, ListChecks),
  item("reminders", "nav.reminders", ROUTES.reminders, Bell),
  item("members", "nav.members", ROUTES.members, Users),
  item("groups", "nav.groups", ROUTES.groups, UsersRound),
  item("reports", "nav.reports", ROUTES.reports, ChartColumn),
];

// Mockup sidebar order; "Sắp đến hạn" and "Trợ lý AI" are added so every screen is reachable on desktop.
export const SIDEBAR_ITEMS: NavItem[] = [
  item("today", "nav.today", ROUTES.today, House),
  item("calendar", "nav.calendar", ROUTES.calendar, CalendarDays),
  item("tasks", "nav.tasks", ROUTES.tasks, ListChecks, { badge: "tasksToday" }),
  item("reminders", "nav.reminders", ROUTES.reminders, Bell),
  item("upcoming", "nav.upcoming", ROUTES.upcoming, CalendarClock),
  item("timetable", "nav.timetable", ROUTES.timetable, BookOpen),
  item("health", "nav.health", ROUTES.health, HeartPulse, { capability: "health" }),
  item("finance", "nav.finance", ROUTES.finance, Wallet, { capability: "finance" }),
  item("specialDays", "nav.specialDays", ROUTES.specialDays, Cake),
  item("members", "nav.members", ROUTES.members, Users),
  item("groups", "nav.groupsShare", ROUTES.groups, Share2),
  item("storage", "nav.storage", ROUTES.storage, FolderOpen, { capability: "storage" }),
  item("assistant", "nav.assistant", ROUTES.assistant, Bot, { capability: "ai" }),
  item("settings", "nav.settings", ROUTES.settings, Settings),
];

export const QUICK_TOOLS: NavItem[] = [
  item("createEvent", "nav.createEvent", ROUTES.calendar, CalendarPlus, { action: "quickAdd" }),
  item("medication", "nav.medicationReminder", `${ROUTES.health}?tab=meds`, Pill, { capability: "health" }),
  item("documents", "nav.documents", ROUTES.storage, FileText, { capability: "storage" }),
  item("templates", "nav.templates", ROUTES.templates, CalendarRange),
  item("export", "nav.exportCalendar", `${ROUTES.settings}?tab=data`, FileDown),
];

export const MOBILE_TABS: NavItem[] = [
  item("today", "nav.today", ROUTES.today, House),
  item("week", "nav.week", `${ROUTES.calendar}?view=week`, CalendarDays),
  item("add", "nav.add", ROUTES.today, Plus, { action: "quickAdd" }),
  item("upcoming", "nav.upcoming", ROUTES.upcoming, CalendarClock),
  item("family", "nav.family", ROUTES.members, Users, { action: "familySheet" }),
];

export const FAMILY_SHEET_ITEMS: NavItem[] = [
  item("tasks", "nav.tasks", ROUTES.tasks, ListChecks, { badge: "tasksToday" }),
  item("reminders", "nav.reminders", ROUTES.reminders, Bell),
  item("timetable", "nav.timetable", ROUTES.timetable, BookOpen),
  item("health", "nav.health", ROUTES.health, HeartPulse, { capability: "health" }),
  item("finance", "nav.finance", ROUTES.finance, Wallet, { capability: "finance" }),
  item("specialDays", "nav.specialDays", ROUTES.specialDays, Cake),
  item("members", "nav.members", ROUTES.members, Users),
  item("groups", "nav.groupsShare", ROUTES.groups, Share2),
  item("storage", "nav.storage", ROUTES.storage, FolderOpen, { capability: "storage" }),
  item("reports", "nav.reports", ROUTES.reports, ChartColumn),
  item("assistant", "nav.assistant", ROUTES.assistant, Bot, { capability: "ai" }),
  item("permissions", "nav.permissions", ROUTES.permissions, ShieldCheck, { capability: "permissions" }),
  item("templates", "nav.templates", ROUTES.templates, CalendarRange),
  item("settings", "nav.settings", ROUTES.settings, Settings),
];

export const FOOTER_LINKS: NavItem[] = [
  item("about", "footer.about", ROUTES.about, FileText),
  item("terms", "footer.terms", ROUTES.terms, FileText),
  item("privacy", "footer.privacy", ROUTES.privacy, ShieldCheck),
  item("contact", "footer.contact", ROUTES.contact, FileText),
  item("help", "footer.help", ROUTES.help, FileText),
];

/** Gated items stay hidden while access is still loading, so they never flash for a child profile. */
export function visibleNav(items: NavItem[], access: AccessContext | undefined): NavItem[] {
  return items.filter((i) => !i.capability || (access !== undefined && hasLevel(access, i.capability, "VIEW")));
}

/** Active when the pathname is the item's route or nested under it ("/" only matches itself). */
export function isActive(href: string, pathname: string): boolean {
  const target = new URL(href, "http://x").pathname.replace(/\/$/, "") || "/";
  const current = pathname.replace(/\/$/, "") || "/";
  return target === "/" ? current === "/" : current === target || current.startsWith(`${target}/`);
}
