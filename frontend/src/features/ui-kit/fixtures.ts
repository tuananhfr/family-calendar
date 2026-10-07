import type { Category } from "@/design/categories";

// Review Focus #2: 120 chars with Vietnamese diacritics + emoji must clamp without breaking grids.
export const LONG_TITLE = "🎂 Sinh nhật Bà Nội tròn 80 tuổi, cả nhà về quê Nam Định ăn mừng, nhớ mua bánh kem, hoa tươi và chuẩn bị quà cho bà 🎉🎁";

export const MEMBERS = [
  { name: "Bố", preset: "father", colorVar: "--cat-study-bg" },
  { name: "Mẹ", preset: "mother", colorVar: "--cat-health-bg" },
  { name: "Bé An", preset: "boy", colorVar: "--cat-activity-bg" },
  { name: "Bé Minh", preset: "girl", colorVar: "--cat-special-bg" },
  { name: "Ông Nội", colorVar: "--cat-document-bg" },
] as const;

export interface TaskRow {
  id: string;
  title: string;
  category: Category;
  assignee: string;
  due: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "TODO" | "DONE" | "OVERDUE";
}

export const TASK_ROWS: TaskRow[] = [
  { id: "1", title: "Mua sách cho bé An", category: "FAMILY", assignee: "Mẹ", due: "Hôm nay", priority: "HIGH", status: "TODO" },
  { id: "2", title: "Đóng học phí tháng 10", category: "FINANCE", assignee: "Bố", due: "Hôm nay", priority: "HIGH", status: "OVERDUE" },
  { id: "3", title: LONG_TITLE, category: "SPECIAL", assignee: "Cả nhà", due: "19/10/2026", priority: "MEDIUM", status: "TODO" },
  { id: "4", title: "Tưới cây ban công", category: "HOUSEWORK", assignee: "Bé Minh", due: "Hôm nay", priority: "LOW", status: "DONE" },
];
