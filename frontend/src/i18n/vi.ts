import { calendarVi } from "./sections/calendar";
import { remindersVi } from "./sections/reminders";
import { tasksVi } from "./sections/tasks";
import { itemsVi } from "./sections/items";
import { membersVi, profileVi, relationshipVi } from "./sections/members";
import { onboardingVi } from "./sections/onboarding";
import { specialDaysVi } from "./sections/special-days";
import { templatesVi } from "./sections/templates";
import { audioVi, notificationsVi } from "./sections/notifications";
import { printVi, settingsVi } from "./sections/settings";
import { financeVi } from "./sections/finance";
import { healthVi } from "./sections/health";
import { storageVi } from "./sections/storage";
import { timetableVi } from "./sections/timetable";
import { todayVi } from "./sections/today";
import { upcomingVi } from "./sections/upcoming";
import { landingVi } from "./sections/landing";
import { preferencesVi } from "./sections/preferences";

export const vi = {
  appName: "Lịch Gia Đình",
  tagline: "Hôm nay nhà mình có gì?",
  script: {
    together: "Nhà mình cùng xem cùng sắp xếp",
    footer: "Làm việc nhẹ hơn. Mỗi ngày tốt hơn!",
  },
  nav: {
    today: "Hôm nay",
    calendar: "Lịch",
    week: "Tuần",
    tasks: "Việc cần làm",
    reminders: "Nhắc nhở",
    timetable: "Thời khóa biểu",
    health: "Sức khỏe",
    finance: "Tài chính gia đình",
    specialDays: "Ngày đặc biệt",
    members: "Thành viên",
    groups: "Nhóm",
    groupsShare: "Nhóm & Chia sẻ",
    storage: "Kho lưu trữ",
    reports: "Báo cáo",
    settings: "Cài đặt",
    upcoming: "Sắp đến hạn",
    family: "Gia đình",
    add: "Thêm",
    addNew: "Thêm mới",
    assistant: "Trợ lý AI",
    permissions: "Quản lý quyền",
    templates: "Mẫu kế hoạch",
    quickTools: "Công cụ nhanh",
    createEvent: "Tạo sự kiện",
    medicationReminder: "Nhắc uống thuốc",
    documents: "Quản lý giấy tờ",
    exportCalendar: "Xuất lịch (ICS/PDF)",
    notifications: "Thông báo",
    search: "Tìm kiếm",
    addMember: "Thêm thành viên",
    onboarding: "Bắt đầu",
    join: "Tham gia gia đình",
    sos: "SOS",
    openMenu: "Mở menu",
    mainNav: "Điều hướng chính",
    quickNav: "Điều hướng nhanh",
    skipToContent: "Bỏ qua đến nội dung",
  },
  shell: {
    switchSpace: "Đổi không gian",
    familySpace: "Nhà mình",
    createGroup: "Tạo nhóm",
    dataModeDetail: "Chi tiết chế độ dữ liệu",
    localModeBody: "Dữ liệu chỉ nằm trên thiết bị này. Chưa gửi gì lên máy chủ.",
    sosSoonTitle: "SOS",
    sosSoonBody: "Nút SOS sẽ có ở bản cập nhật tới. Khi khẩn cấp, hãy gọi 113 (công an), 114 (cứu hỏa), 115 (cấp cứu).",
    footerTagline: "Hôm nay nhà mình có gì?",
  },
  footer: {
    about: "Giới thiệu",
    terms: "Điều khoản",
    privacy: "Quyền riêng tư",
    contact: "Liên hệ",
    help: "Trợ giúp",
  },
  dataMode: {
    local: "Trên thiết bị",
    shared: "Đã chia sẻ",
    synced: "Đã đồng bộ",
    pending: "Chờ đồng bộ ({n})",
    conflict: "Cần xử lý",
    offline: "Ngoại tuyến",
    blocked: "Bị chặn",
    accountBacked: "Đã bảo vệ & đồng bộ",
  },
  common: {
    save: "Lưu",
    cancel: "Hủy",
    close: "Đóng",
    delete: "Xóa",
    edit: "Chỉnh sửa",
    add: "Thêm",
    seeAll: "Xem tất cả",
    filter: "Bộ lọc",
    loading: "Đang tải…",
    retry: "Thử lại",
    today: "Hôm nay",
    tomorrow: "Ngày mai",
    daysLeft: "Còn {n} ngày",
    optional: "tùy chọn",
    required: "bắt buộc",
    forbiddenTitle: "Bạn chưa có quyền xem mục này",
    forbiddenBody: "Hãy nhờ chủ gia đình cấp quyền trong Quản lý quyền.",
    errorTitle: "Có lỗi khi tải dữ liệu",
    errorBody: "Dữ liệu trên thiết bị vẫn an toàn. Hãy thử lại.",
    comingSoon: "Màn hình này đang được hoàn thiện.",
  },
  category: {
    STUDY: "Học tập",
    HOUSEWORK: "Việc nhà",
    FAMILY: "Gia đình",
    HEALTH: "Sức khỏe",
    FINANCE: "Tài chính",
    SHOPPING: "Mua sắm",
    DOCUMENT: "Giấy tờ",
    ACTIVITY: "Hoạt động",
    SPORT: "Thể thao",
    SPECIAL: "Ngày đặc biệt",
    OTHER: "Khác",
  },
  priority: {
    HIGH: "Cao",
    MEDIUM: "Trung bình",
    LOW: "Thấp",
  },
  status: {
    TODO: "Chưa xong",
    DONE: "Đã xong",
    OVERDUE: "Quá hạn",
    CANCELLED: "Đã hủy",
  },
  ui: {
    noData: "Chưa có dữ liệu",
    moreMembers: "+{n}",
    showPassword: "Hiện",
    selectPlaceholder: "Chọn…",
    dismiss: "Bỏ qua",
    charCount: "{n}/{max}",
  },
  sos: {
    button: "SOS",
    hold: "Giữ 2 giây để gửi SOS",
  },
  relationship: relationshipVi,
  profile: profileVi,
  members: membersVi,
  onboarding: onboardingVi,
  items: itemsVi,
  today: todayVi,
  calendar: calendarVi,
  tasks: tasksVi,
  reminders: remindersVi,
  upcoming: upcomingVi,
  specialDays: specialDaysVi,
  templates: templatesVi,
  timetable: timetableVi,
  notifications: notificationsVi,
  audio: audioVi,
  settings: settingsVi,
  print: printVi,
  storage: storageVi,
  finance: financeVi,
  health: healthVi,
  landing: landingVi,
  preferences: preferencesVi,
} as const;

// Arrays are allowed for ordered lists (steps); they are indexed like objects: t("onboarding.steps.0").
type Dict = { readonly [k: string]: string | Dict | readonly string[] };

function lookup(path: string): string {
  let node: string | Dict | readonly string[] = vi as Dict;
  for (const part of path.split(".")) {
    if (typeof node === "string" || !(part in node)) {
      throw new Error(`Missing i18n key: ${path}`);
    }
    node = (node as Record<string, string | Dict | readonly string[]>)[part];
  }
  if (typeof node !== "string") throw new Error(`i18n key is not a string: ${path}`);
  return node;
}

export function t(path: string, vars?: Record<string, string | number>): string {
  const raw = lookup(path);
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
